import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpToolResult } from "./types";

interface McpClientConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

const managers: McpClientManager[] = [];
let shutdownRegistered = false;

export class McpClientManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private clientPromise: Promise<Client> | null = null;
  private readonly config: McpClientConfig;

  constructor(config: McpClientConfig) {
    this.config = config;
    managers.push(this);
    registerShutdownHandlers();
  }

  async getClient(): Promise<Client> {
    if (this.client) return this.client;
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = (async () => {
      const transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
      });

      const client = new Client(
        { name: this.config.name, version: "1.0.0" },
        { capabilities: {} }
      );
      await client.connect(transport);
      transport.onerror = () => {
        this.client = null;
        this.transport = null;
        this.clientPromise = null;
      };
      this.transport = transport;
      this.client = client;
      return client;
    })();

    try {
      return await this.clientPromise;
    } catch (error) {
      this.client = null;
      this.transport = null;
      this.clientPromise = null;
      throw error;
    } finally {
      // Once connected successfully, clear the promise so future calls
      // go through the fast path (this.client check).
      if (this.client) {
        this.clientPromise = null;
      }
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    options?: { timeout?: number }
  ): Promise<McpToolResult> {
    const client = await this.getClient();
    const result = await client.callTool(
      { name, arguments: args },
      undefined,
      options?.timeout ? { timeout: options.timeout } : undefined
    );
    return result as McpToolResult;
  }

  async close(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.warn(`[mcp:${this.config.name}] close error (non-fatal):`, error instanceof Error ? error.message : error);
      }
      this.client = null;
      this.transport = null;
      this.clientPromise = null;
    }
  }
}

function registerShutdownHandlers(): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  async function shutdownAll() {
    await Promise.allSettled(managers.map((m) => m.close()));
  }

  process.on("SIGINT", () => { void shutdownAll(); });
  process.on("SIGTERM", () => { void shutdownAll(); });
  process.on("beforeExit", () => { void shutdownAll(); });
}
