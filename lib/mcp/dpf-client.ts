import { CONFIG } from "../config";
import { McpClientManager } from "./client-manager";
import { getTextFromToolResult, type McpToolResult } from "./types";

const manager = new McpClientManager({
  name: "terrascore-dpf",
  command: CONFIG.mcp.dpf.command,
  args: CONFIG.mcp.dpf.args,
  env: {
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
    MLIT_API_KEY: process.env.MLIT_DPF_API_KEY || "",
  },
});

function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  return manager.callTool(name, args);
}

export async function searchByLocation(
  lat: number,
  lon: number,
  radiusKm: number = 1
): Promise<unknown> {
  const result = await callTool("search_by_location_point_distance", {
    location_lat: lat,
    location_lon: lon,
    location_distance: radiusKm * 1000,
  });
  if (result.isError) {
    const text = getTextFromToolResult(result);
    throw new Error(`DPF search returned error: ${text ?? "unknown"}`);
  }
  const text = getTextFromToolResult(result);
  if (!text) {
    throw new Error("DPF search returned no text payload");
  }
  return JSON.parse(text);
}

export async function closeClient(): Promise<void> {
  await manager.close();
}
