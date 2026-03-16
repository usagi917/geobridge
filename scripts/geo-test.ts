import * as fs from "fs";
import * as path from "path";
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("API key set:", !!process.env.MLIT_GEOSPATIAL_API_KEY);
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/geospatial", "python", "src/server.py"],
    env: { ...process.env, LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY || "" },
  });
  const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const r = await client.callTool({
    name: "get_multi_api",
    arguments: { lat: 35.681236, lon: 139.767125, target_apis: [3, 5, 10, 11, 12], save_file: false },
  });
  const text = (r.content as Array<{type: string; text?: string}>).find(c => c.type === "text")?.text;
  if (text) {
    const data = JSON.parse(text);
    console.log("status:", data.status);
    if (data.data?.api_results) {
      data.data.api_results.forEach((r: unknown, i: number) => {
        if (r && typeof r === "object" && "features" in (r as object)) {
          console.log(`  [${i}]: ${((r as {features: unknown[]}).features).length} features`);
        } else {
          console.log(`  [${i}]:`, r === null ? "null" : JSON.stringify(r).substring(0, 200));
        }
      });
    }
    if (data.data?.error) console.log("error:", data.data.error);
    if (data.error) console.log("error:", JSON.stringify(data.error));
    if (data.message) console.log("message:", data.message);
  } else {
    console.log("No text content");
  }
  await transport.close();
}
main().catch(console.error);
