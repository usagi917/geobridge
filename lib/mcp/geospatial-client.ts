import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CONFIG } from "../config";
import { extractLandPriceValue } from "../land-price";
import {
  getTextFromToolResult,
  type GeospatialCallResult,
  type GeospatialToolError,
  type LandPriceHistoryPoint,
  type McpToolResult,
} from "./types";
import { withTimeout } from "./utils";

let geospatialClient: Client | null = null;
let geospatialTransport: StdioClientTransport | null = null;
let geospatialClientPromise: Promise<Client> | null = null;

interface GeospatialEnvelope {
  status?: unknown;
  data?: unknown;
}

interface GeospatialPayload {
  status?: unknown;
  message?: unknown;
  api_results?: unknown;
}

interface GeospatialApiResultEnvelope {
  data?: unknown;
  error?: unknown;
}

async function getClient(): Promise<Client> {
  if (geospatialClient) return geospatialClient;
  if (geospatialClientPromise) return geospatialClientPromise;

  geospatialClientPromise = (async () => {
    const transport = new StdioClientTransport({
      command: CONFIG.mcp.geospatial.command,
      args: CONFIG.mcp.geospatial.args,
      env: {
        ...process.env,
        LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY || "",
      },
    });

    const client = new Client({ name: "terrascore-geospatial", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    geospatialTransport = transport;
    geospatialClient = client;
    return client;
  })();

  try {
    return await geospatialClientPromise;
  } catch (error) {
    geospatialClient = null;
    geospatialTransport = null;
    throw error;
  } finally {
    if (geospatialClient) {
      geospatialClientPromise = null;
    }
  }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  return result as McpToolResult;
}

function getTextContent(result: McpToolResult): string {
  const text = getTextFromToolResult(result);
  if (!text) {
    throw new Error("MLIT Geospatial MCP returned no text payload");
  }
  return text;
}

function parseEnvelope(result: McpToolResult): GeospatialPayload {
  if (result.isError) {
    throw new Error("MLIT Geospatial MCP returned an error result");
  }

  const parsed = JSON.parse(getTextContent(result)) as GeospatialEnvelope;

  if (parsed.status !== "success") {
    const message = typeof parsed.data === "string"
      ? parsed.data
      : "MLIT Geospatial MCP request failed";
    throw new Error(message);
  }

  const payload = (parsed.data ?? {}) as GeospatialPayload;
  if (payload.status === "need_confirmation") {
    const message = typeof payload.message === "string"
      ? payload.message
      : "MLIT Geospatial MCP requested confirmation";
    throw new Error(message);
  }

  return payload;
}

function extractApiResults(payload: GeospatialPayload): unknown[] {
  return Array.isArray(payload.api_results) ? payload.api_results : [];
}

function extractGeojson(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const data = (result as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

function extractApiErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;

  const error = (result as GeospatialApiResultEnvelope).error;
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  }

  return null;
}

function toToolError(tool: string, message: string): GeospatialToolError {
  return { tool, message };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function getMultiApi(
  lat: number,
  lon: number,
  targetApis: number[],
  distance?: number
): Promise<GeospatialCallResult<Record<string, unknown>>> {
  const args: Record<string, unknown> = {
    lat,
    lon,
    target_apis: targetApis,
    save_file: false,
  };
  if (distance !== undefined) {
    args.distance = distance;
  }

  const payload = parseEnvelope(await callTool("get_multi_api", args));
  const apiResults = extractApiResults(payload);
  const mappedResults: Record<string, unknown> = {};
  const errors: GeospatialToolError[] = [];

  targetApis.forEach((apiCode, index) => {
    const apiResult = apiResults[index];
    const geojson = extractGeojson(apiResult);
    if (geojson) {
      mappedResults[String(apiCode)] = geojson;
    }
    const errorMessage = extractApiErrorMessage(apiResult);
    if (errorMessage) {
      errors.push(toToolError(`get_multi_api:API${apiCode}`, errorMessage));
    }
  });

  return {
    data: Object.keys(mappedResults).length > 0 ? mappedResults : null,
    errors,
  };
}

export async function getLandPrice(lat: number, lon: number): Promise<unknown> {
  const result = await getMultiApi(lat, lon, [3]);
  if (!result.data || typeof result.data !== "object") return null;
  return result.data["3"] ?? null;
}

export async function getUrbanPlanning(lat: number, lon: number): Promise<unknown> {
  const result = await getMultiApi(lat, lon, [4]);
  if (!result.data || typeof result.data !== "object") return null;
  return result.data["4"] ?? null;
}

export async function getLandPriceHistory(
  lat: number,
  lon: number,
  startYear: number = CONFIG.report.landPriceLatestYear - CONFIG.report.landPriceHistoryYears,
  endYear: number = CONFIG.report.landPriceLatestYear
): Promise<GeospatialCallResult<LandPriceHistoryPoint[]>> {
  const effectiveEndYear = Math.min(endYear, CONFIG.report.landPriceLatestYear);
  const effectiveStartYear = Math.max(1995, Math.min(startYear, effectiveEndYear));
  const years = Array.from(
    { length: effectiveEndYear - effectiveStartYear + 1 },
    (_, index) => effectiveStartYear + index
  );
  const perRequestTimeout = CONFIG.mcp.toolTimeout;
  const concurrency = CONFIG.mcp.landPriceHistoryConcurrency;

  const yearResults = await mapWithConcurrency(years, concurrency, async (year) => {
    const errors: GeospatialToolError[] = [];

    try {
      const args: Record<string, unknown> = {
        lat,
        lon,
        target_apis: [3],
        save_file: false,
        year,
      };
      const payload = parseEnvelope(
        await withTimeout(
          callTool("get_multi_api", args),
          perRequestTimeout,
          `MLIT land price history ${year}`
        )
      );
      const apiResults = extractApiResults(payload);
      const geojson = extractGeojson(apiResults[0]);
      const errorMessage = extractApiErrorMessage(apiResults[0]);
      if (errorMessage) {
        errors.push(toToolError(`land_price_history:${year}`, errorMessage));
      }
      return { year, data: geojson, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        year,
        data: null,
        errors: [toToolError(`land_price_history:${year}`, message)],
      };
    }
  });

  const points: LandPriceHistoryPoint[] = [];
  const errors: GeospatialToolError[] = [];

  for (const yearResult of yearResults) {
    errors.push(...yearResult.errors);
    if (!yearResult.data) continue;

    const { year, data } = yearResult;
    const obj = data as Record<string, unknown>;
    const features = Array.isArray(obj.features)
      ? (obj.features as Array<Record<string, unknown>>)
      : [];

    if (features.length === 0) continue;

    // Pick closest point (first feature)
    const props = (features[0].properties || {}) as Record<string, unknown>;
    const price = extractLandPriceValue(props) ?? 0;
    if (price >= 100) {
      points.push({
        year,
        price,
        address: pickString(props, ["location", "address", "L01_019", "residence_display_name_ja"]),
      });
    }
  }

  points.sort((a, b) => a.year - b.year);
  return {
    data: points.length === 0 ? null : points,
    errors,
  };
}

export async function closeClient(): Promise<void> {
  if (geospatialTransport) {
    await geospatialTransport.close();
    geospatialClient = null;
    geospatialTransport = null;
    geospatialClientPromise = null;
  }
}

function pickString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}
