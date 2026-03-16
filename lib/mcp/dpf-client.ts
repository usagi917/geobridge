import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CONFIG } from "../config";
import { getTextFromToolResult, type McpToolResult } from "./types";

let dpfClient: Client | null = null;
let dpfTransport: StdioClientTransport | null = null;
let dpfClientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (dpfClient) return dpfClient;
  if (dpfClientPromise) return dpfClientPromise;

  dpfClientPromise = (async () => {
    const transport = new StdioClientTransport({
      command: CONFIG.mcp.dpf.command,
      args: CONFIG.mcp.dpf.args,
      env: {
        ...process.env,
        MLIT_API_KEY: process.env.MLIT_DPF_API_KEY || "",
      },
    });

    const client = new Client({ name: "terrascore-dpf", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    dpfTransport = transport;
    dpfClient = client;
    return client;
  })();

  try {
    return await dpfClientPromise;
  } catch (error) {
    dpfClient = null;
    dpfTransport = null;
    throw error;
  } finally {
    if (dpfClient) {
      dpfClientPromise = null;
    }
  }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  return result as McpToolResult;
}

export async function searchByLocation(
  lat: number,
  lon: number,
  radiusKm: number = 1
): Promise<unknown> {
  try {
    const result = await callTool("search_by_location_point_distance", {
      location_lat: lat,
      location_lon: lon,
      location_distance: radiusKm * 1000,
    });
    if (result.isError) return null;
    const text = getTextFromToolResult(result);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function searchByKeyword(keyword: string): Promise<unknown> {
  try {
    const result = await callTool("search", { keyword });
    if (result.isError) return null;
    const text = getTextFromToolResult(result);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function closeClient(): Promise<void> {
  if (dpfTransport) {
    await dpfTransport.close();
    dpfClient = null;
    dpfTransport = null;
    dpfClientPromise = null;
  }
}
