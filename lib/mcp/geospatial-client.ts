import { CONFIG } from "../config";
import { extractLandPriceValue } from "../land-price";
import { mapWithConcurrency } from "../utils/concurrency";
import { pickString } from "../utils/strings";
import { McpClientManager } from "./client-manager";
import {
  getTextFromToolResult,
  type GeospatialCallResult,
  type GeospatialToolError,
  type LandPriceHistoryPoint,
  type McpToolResult,
} from "./types";

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

const manager = new McpClientManager({
  name: "terrascore-geospatial",
  command: CONFIG.mcp.geospatial.command,
  args: CONFIG.mcp.geospatial.args,
  env: {
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
    LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY || "",
  },
});

function callTool(name: string, args: Record<string, unknown>, timeout?: number): Promise<McpToolResult> {
  return manager.callTool(name, args, timeout ? { timeout } : undefined);
}

function normalizeToolError(
  error: unknown,
  timeoutLabel?: string,
  timeoutMs?: number
): Error {
  if (error instanceof Error) {
    if (
      timeoutLabel &&
      timeoutMs &&
      /timed out|timeout/i.test(error.message) &&
      !error.message.startsWith("Timeout:")
    ) {
      return new Error(`Timeout: ${timeoutLabel} (${timeoutMs}ms)`);
    }
    return error;
  }

  const message = String(error);
  if (timeoutLabel && timeoutMs && /timed out|timeout/i.test(message)) {
    return new Error(`Timeout: ${timeoutLabel} (${timeoutMs}ms)`);
  }
  return new Error(message);
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

export async function getMultiApi(
  lat: number,
  lon: number,
  targetApis: number[],
  distance?: number,
  options?: { timeout?: number }
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

  let payload: GeospatialPayload;
  try {
    payload = parseEnvelope(await callTool("get_multi_api", args, options?.timeout));
  } catch (error) {
    throw normalizeToolError(error, "MLIT multi_api", options?.timeout);
  }

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

export async function getLandPricePoint(
  lat: number,
  lon: number,
  year: number = CONFIG.report.landPriceLatestYear,
  options?: { distance?: number; timeout?: number; timeoutLabel?: string }
): Promise<GeospatialCallResult<Record<string, unknown>>> {
  const args: Record<string, unknown> = {
    lat,
    lon,
    year,
    save_file: false,
  };
  if (options?.distance !== undefined) {
    args.distance = options.distance;
  }

  let payload: GeospatialPayload;
  try {
    payload = parseEnvelope(
      await callTool("get_land_price_point_by_location", args, options?.timeout)
    );
  } catch (error) {
    throw normalizeToolError(error, options?.timeoutLabel, options?.timeout);
  }

  const apiResults = extractApiResults(payload);
  const geojson = extractGeojson(apiResults[0]);
  const errorMessage = extractApiErrorMessage(apiResults[0]);

  return {
    data: geojson,
    errors: errorMessage
      ? [toToolError("get_land_price_point_by_location", errorMessage)]
      : [],
  };
}

export async function getLandPriceHistory(
  lat: number,
  lon: number,
  startYear: number = CONFIG.report.landPriceLatestYear - CONFIG.report.landPriceHistoryYears,
  endYear: number = CONFIG.report.landPriceLatestYear,
  options?: { distance?: number; timeout?: number }
): Promise<GeospatialCallResult<LandPriceHistoryPoint[]>> {
  const effectiveEndYear = Math.min(endYear, CONFIG.report.landPriceLatestYear);
  const effectiveStartYear = Math.max(1995, Math.min(startYear, effectiveEndYear));
  const years = Array.from(
    { length: effectiveEndYear - effectiveStartYear + 1 },
    (_, index) => effectiveStartYear + index
  );
  const perRequestTimeout = options?.timeout ?? CONFIG.mcp.geospatialLandPriceTimeout;
  const concurrency = CONFIG.mcp.landPriceHistoryConcurrency;

  const yearResults = await mapWithConcurrency(years, concurrency, async (year) => {
    const errors: GeospatialToolError[] = [];

    try {
      const pointResult = await getLandPricePoint(
        lat,
        lon,
        year,
        {
          distance: options?.distance,
          timeout: perRequestTimeout,
          timeoutLabel: `MLIT land price history ${year}`,
        }
      );

      errors.push(
        ...pointResult.errors.map((error) =>
          toToolError(`land_price_history:${year}`, error.message)
        )
      );

      return { year, data: pointResult.data, errors };
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
  await manager.close();
}
