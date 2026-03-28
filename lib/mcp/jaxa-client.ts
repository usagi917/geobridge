import { CONFIG } from "../config";
import { buildMonthlyTimeseriesPoints, type RawSpatialStatsSeries } from "../monthly-timeseries";
import {
  convertMonthlyRateStatsToAccumulation,
  convertMonthlyRateTimeseriesToAccumulation,
} from "../precipitation";
import { allSettledWithConcurrency } from "../utils/concurrency";
import { McpClientManager } from "./client-manager";
import {
  createBbox,
  getTextFromToolResult,
  type JaxaLayerImage,
  type JaxaSpatialStats,
  type JaxaTimeseries,
  type JaxaTimeseriesPoint,
  type McpImageContent,
  type McpToolResult,
} from "./types";

function getJaxaProcessEnv(): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );

  env.MPLCONFIGDIR = env.MPLCONFIGDIR || "/tmp/terrascore-matplotlib";
  env.XDG_CACHE_HOME = env.XDG_CACHE_HOME || "/tmp/terrascore-cache";
  return env;
}

const manager = new McpClientManager({
  name: "terrascore-jaxa",
  command: CONFIG.mcp.jaxa.command,
  args: CONFIG.mcp.jaxa.args,
  env: getJaxaProcessEnv(),
});

function callTool(name: string, args: Record<string, unknown>, timeout?: number): Promise<McpToolResult> {
  return manager.callTool(name, args, timeout ? { timeout } : undefined);
}

function toIsoWithoutMillis(date: Date): string {
  return date.toISOString().split(".")[0];
}

function getSafeMonthlyDataEndDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() - CONFIG.mcp.jaxaMonthlyLagMonths + 1,
    0,
    23,
    59,
    59
  ));
}

function getMonthlyWindow(months: number): [string, string] {
  const safeEnd = getSafeMonthlyDataEndDate();
  const safeStart = new Date(Date.UTC(
    safeEnd.getUTCFullYear(),
    safeEnd.getUTCMonth() - months + 1,
    1,
    0,
    0,
    0
  ));
  return [toIsoWithoutMillis(safeStart), toIsoWithoutMillis(safeEnd)];
}

function getLatestMonthlyWindow(): [string, string] {
  return getMonthlyWindow(1);
}

// JAXA monthly rasters are much coarser than the app's default 400m search radius.
// Keep the bbox wide enough to cover at least a couple of pixels per axis, otherwise
// the upstream client can fail with errors such as `min() iterable argument is empty`.
const SGLI_MIN_RADIUS_M = 3_000;
const GSMAP_MIN_RADIUS_M = 12_000;

function ensureMinimumRadius(radiusM: number, minRadiusM: number): number {
  return Math.max(radiusM, minRadiusM);
}

function getLatestImageContent(result: McpToolResult): McpImageContent | null {
  const images = result.content.filter(
    (content): content is McpImageContent =>
      content.type === "image" &&
      typeof content.data === "string" &&
      typeof content.mimeType === "string"
  );
  return images.at(-1) ?? null;
}

function getToolErrorMessage(result: McpToolResult, fallback: string): string {
  return getTextFromToolResult(result) || fallback;
}

async function showImage(
  id: JaxaLayerImage["id"],
  title: string,
  description: string,
  collectionId: string,
  band: string,
  lat: number,
  lon: number,
  radiusM: number,
  dateRange: [string, string],
  timeout?: number
): Promise<JaxaLayerImage | null> {
  const bbox = createBbox(lat, lon, radiusM);
  const result = await callTool("show_images", {
    collection: collectionId,
    band,
    bbox,
    dlim: dateRange,
  }, timeout);

  if (result.isError) {
    throw new Error(getToolErrorMessage(result, `JAXA show_images failed: ${id}`));
  }

  const image = getLatestImageContent(result);
  if (!image?.data || !image.mimeType) return null;

  return {
    id,
    title,
    description,
    imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
    bbox,
    capturedRange: dateRange,
  };
}

async function calcSpatialStats(
  collectionId: string,
  band: string,
  lat: number,
  lon: number,
  radiusM: number = 400,
  dateRange?: [string, string],
  timeout?: number
): Promise<JaxaSpatialStats | null> {
  const bbox = createBbox(lat, lon, radiusM);
  const args: Record<string, unknown> = {
    collection: collectionId,
    band,
    bbox,
  };
  if (dateRange) {
    args.dlim = dateRange;
  }

  const result = await callTool("calc_spatial_stats", args, timeout);
  if (result.isError) {
    throw new Error(
      getToolErrorMessage(result, `JAXA calc_spatial_stats failed: ${collectionId}/${band}`)
    );
  }

  const text = getTextFromToolResult(result);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `JAXA calc_spatial_stats returned invalid JSON for ${collectionId}/${band}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function getElevation(lat: number, lon: number, radiusM: number = 400, options?: { timeout?: number }): Promise<JaxaSpatialStats | null> {
  return calcSpatialStats(
    "JAXA.EORC_ALOS.PRISM_AW3D30.v3.2_global",
    "DSM",
    lat, lon, radiusM,
    ["2021-02-01T00:00:00", "2021-02-28T00:00:00"],
    options?.timeout
  );
}

export async function getNdvi(lat: number, lon: number, radiusM: number = 400, options?: { timeout?: number }): Promise<JaxaSpatialStats | null> {
  return calcSpatialStats(
    "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-NDVI.daytime.v3_global_monthly",
    "NDVI",
    lat, lon, ensureMinimumRadius(radiusM, SGLI_MIN_RADIUS_M),
    getLatestMonthlyWindow(),
    options?.timeout
  );
}

export async function getLst(lat: number, lon: number, radiusM: number = 400, options?: { timeout?: number }): Promise<JaxaSpatialStats | null> {
  return calcSpatialStats(
    "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-LST.daytime.v3_global_monthly",
    "LST",
    lat, lon, ensureMinimumRadius(radiusM, SGLI_MIN_RADIUS_M),
    getLatestMonthlyWindow(),
    options?.timeout
  );
}

// GSMaP spatial resolution is 0.1° (≈10km), so we need a larger bbox (GSMAP_MIN_RADIUS_M).
export async function getPrecipitation(lat: number, lon: number, options?: { timeout?: number }): Promise<JaxaSpatialStats | null> {
  const gsmapRadiusM = GSMAP_MIN_RADIUS_M;
  const dateRange = getLatestMonthlyWindow();
  const stats = await calcSpatialStats(
    "JAXA.EORC_GSMaP_standard.Gauge.00Z-23Z.v6_monthly",
    "PRECIP",
    lat, lon, gsmapRadiusM,
    dateRange,
    options?.timeout
  );
  return convertMonthlyRateStatsToAccumulation(stats, dateRange);
}

export async function getNdviImage(lat: number, lon: number, radiusM: number = 400, options?: { timeout?: number }): Promise<JaxaLayerImage | null> {
  return showImage(
    "ndvi",
    "植生分布",
    "直近取得期間の NDVI ラスタ",
    "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-NDVI.daytime.v3_global_monthly",
    "NDVI",
    lat,
    lon,
    ensureMinimumRadius(radiusM, SGLI_MIN_RADIUS_M),
    getLatestMonthlyWindow(),
    options?.timeout
  );
}

export async function getLstImage(lat: number, lon: number, radiusM: number = 400, options?: { timeout?: number }): Promise<JaxaLayerImage | null> {
  return showImage(
    "lst",
    "地表面温度",
    "直近取得期間の地表面温度ラスタ",
    "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-LST.daytime.v3_global_monthly",
    "LST",
    lat,
    lon,
    ensureMinimumRadius(radiusM, SGLI_MIN_RADIUS_M),
    getLatestMonthlyWindow(),
    options?.timeout
  );
}

export async function getPrecipitationImage(lat: number, lon: number, options?: { timeout?: number }): Promise<JaxaLayerImage | null> {
  const gsmapRadiusM = GSMAP_MIN_RADIUS_M;
  return showImage(
    "precipitation",
    "降水量",
    "直近取得期間の月次降水ラスタ",
    "JAXA.EORC_GSMaP_standard.Gauge.00Z-23Z.v6_monthly",
    "PRECIP",
    lat,
    lon,
    gsmapRadiusM,
    getLatestMonthlyWindow(),
    options?.timeout
  );
}

// --- Timeseries functions ---

async function calcSpatialStatsTimeseries(
  collectionId: string,
  band: string,
  lat: number,
  lon: number,
  radiusM: number,
  years: number,
  timeout?: number,
): Promise<JaxaTimeseries | null> {
  const safeEndDate = getSafeMonthlyDataEndDate();
  const endYear = safeEndDate.getUTCFullYear();
  const startYear = endYear - Math.max(years - 1, 0);

  const yearChunks: Array<{ year: number; dateRange: [string, string] }> = [];
  for (let y = startYear; y < endYear; y++) {
    yearChunks.push({
      year: y,
      dateRange: [`${y}-01-01T00:00:00`, `${y}-12-31T23:59:59`],
    });
  }
  // Add current partial year
  yearChunks.push({
    year: endYear,
    dateRange: [`${endYear}-01-01T00:00:00`, toIsoWithoutMillis(safeEndDate)],
  });

  const bbox = createBbox(lat, lon, radiusM);

  // Per-chunk timeout is passed to the SDK's callTool, which sends a
  // cancellation notification to the server on timeout (unlike the old
  // custom withTimeout wrapper that just abandoned the promise).
  const chunkTimeout = timeout;

  const chunkTasks = yearChunks.map(({ dateRange, year }) => {
    return async () => {
      const result = await callTool("calc_spatial_stats", {
        collection: collectionId,
        band,
        bbox,
        dlim: dateRange,
      }, chunkTimeout);
      if (result.isError) throw new Error("Tool error");
      const text = getTextFromToolResult(result);
      if (!text) throw new Error("No text");
      const parsed = JSON.parse(text) as RawSpatialStatsSeries;
      return { raw: parsed, year };
    };
  });

  // Limit concurrency to avoid flooding the JAXA server with simultaneous
  // requests (previously all year chunks fired in parallel).
  const results = await allSettledWithConcurrency(chunkTasks, CONFIG.mcp.jaxaConcurrency);

  // Combine successful results
  const allPoints: JaxaTimeseriesPoint[] = [];
  let detectedUnit: string | undefined;

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { raw, year } = r.value;
    if (!detectedUnit && raw.unit) detectedUnit = raw.unit;
    allPoints.push(...buildMonthlyTimeseriesPoints(raw, year));
  }

  if (allPoints.length === 0) return null;

  // Sort by date
  allPoints.sort((a, b) => a.date.localeCompare(b.date));

  return { points: allPoints, unit: detectedUnit };
}

export async function getTimeseriesNdvi(
  lat: number,
  lon: number,
  radiusM: number = 400,
  years: number = 5,
  options?: { timeout?: number }
): Promise<JaxaTimeseries | null> {
  const ts = await calcSpatialStatsTimeseries(
    "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-NDVI.daytime.v3_global_monthly",
    "NDVI",
    lat, lon, ensureMinimumRadius(radiusM, SGLI_MIN_RADIUS_M), years,
    options?.timeout
  );
  if (ts) ts.unit = "";
  return ts;
}

export async function getTimeseriesLst(
  lat: number,
  lon: number,
  radiusM: number = 400,
  years: number = 5,
  options?: { timeout?: number }
): Promise<JaxaTimeseries | null> {
  const ts = await calcSpatialStatsTimeseries(
    "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-LST.daytime.v3_global_monthly",
    "LST",
    lat, lon, ensureMinimumRadius(radiusM, SGLI_MIN_RADIUS_M), years,
    options?.timeout
  );
  return ts;
}

export async function getTimeseriesPrecipitation(
  lat: number,
  lon: number,
  years: number = 5,
  options?: { timeout?: number }
): Promise<JaxaTimeseries | null> {
  const gsmapRadiusM = GSMAP_MIN_RADIUS_M;
  const ts = await calcSpatialStatsTimeseries(
    "JAXA.EORC_GSMaP_standard.Gauge.00Z-23Z.v6_monthly",
    "PRECIP",
    lat, lon, gsmapRadiusM, years,
    options?.timeout
  );
  return convertMonthlyRateTimeseriesToAccumulation(ts);
}

export async function closeClient(): Promise<void> {
  await manager.close();
}
