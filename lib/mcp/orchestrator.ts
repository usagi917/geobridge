import * as jaxa from "./jaxa-client";
import * as geospatial from "./geospatial-client";
import * as dpf from "./dpf-client";
import { withTimeout } from "./utils";
import { CONFIG, type Perspective } from "../config";
import type { GeospatialCallResult, OrchestratorResult } from "./types";
import { CitationTracker } from "../report/citations";
import { allSettledWithConcurrency } from "../utils/concurrency";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  factory: () => Promise<T>,
  retries: number,
  label: string,
  shouldRetry: (error: unknown) => boolean = () => true
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await factory();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      attempt += 1;
      await sleep(attempt * 750);
      console.warn(`[orchestrator] retrying ${label} (${attempt}/${retries})`);
    }
  }
}

export type ProgressCallback = (step: string) => void;

export interface OrchestrationInput {
  latitude: number;
  longitude: number;
  radiusM: number;
  perspective: Perspective;
  onProgress?: ProgressCallback;
}

export interface OrchestrationOutput {
  result: OrchestratorResult;
  citations: CitationTracker;
}

export async function orchestrate(input: OrchestrationInput): Promise<OrchestrationOutput> {
  const { latitude, longitude, radiusM, perspective, onProgress } = input;
  const timeout = CONFIG.mcp.toolTimeout;
  const jaxaStatsTimeout = CONFIG.mcp.jaxaStatsTimeout;
  const jaxaImageTimeout = CONFIG.mcp.jaxaImageTimeout;
  const jaxaConcurrency = CONFIG.mcp.jaxaConcurrency;
  const jaxaRetryCount = CONFIG.mcp.jaxaRetryCount;
  const citations = new CitationTracker();
  const errors: OrchestratorResult["errors"] = [];

  const targetApis = CONFIG.perspectiveApiMap[perspective];

  // Wrap each call to emit progress on completion
  function tracked<T>(promise: Promise<T>, label: string): Promise<T> {
    return promise.then(
      (v) => { onProgress?.(`${label} 完了`); return v; },
      (e) => { onProgress?.(`${label} 失敗`); throw e; }
    );
  }

  onProgress?.("MCP データ取得開始");

  const timeseriesTimeout = CONFIG.mcp.timeseriesTimeout;
  const tsYears = CONFIG.report.jaxaTimeseriesYears;
  const lpEndYear = Math.min(new Date().getFullYear(), CONFIG.report.landPriceLatestYear);
  const lpStartYear = lpEndYear - CONFIG.report.landPriceHistoryYears;

  const shouldRetryJaxa = () => true;

  function createJaxaTask<T>(
    promiseFactory: () => Promise<T>,
    timeoutMs: number,
    timeoutLabel: string,
    progressLabel: string
  ): () => Promise<T> {
    return () =>
      tracked(
        withRetry(
          () => withTimeout(promiseFactory(), timeoutMs, timeoutLabel),
          jaxaRetryCount,
          timeoutLabel,
          shouldRetryJaxa
        ),
        progressLabel
      );
  }

  const nonJaxaResultsPromise = Promise.allSettled([
    tracked(
      withTimeout(
        geospatial.getMultiApi(latitude, longitude, targetApis, Math.min(radiusM, 425)),
        timeout,
        "MLIT multi_api"
      ),
      "MLIT 行政データ"
    ),
    tracked(withTimeout(dpf.searchByLocation(latitude, longitude), timeout, "DPF search"), "MLIT DPF"),
    tracked(
      withTimeout(
        geospatial.getLandPriceHistory(latitude, longitude, lpStartYear, lpEndYear),
        timeseriesTimeout,
        "MLIT land price history"
      ),
      "地価推移"
    ),
  ]);

  const jaxaStatsTasks = [
    createJaxaTask(
      () => jaxa.getElevation(latitude, longitude, radiusM),
      jaxaStatsTimeout,
      "JAXA elevation",
      "JAXA 標高"
    ),
    createJaxaTask(
      () => jaxa.getNdvi(latitude, longitude, radiusM),
      jaxaStatsTimeout,
      "JAXA NDVI",
      "JAXA NDVI"
    ),
    createJaxaTask(
      () => jaxa.getLst(latitude, longitude, radiusM),
      jaxaStatsTimeout,
      "JAXA LST",
      "JAXA 地表面温度"
    ),
    createJaxaTask(
      () => jaxa.getPrecipitation(latitude, longitude),
      jaxaStatsTimeout,
      "JAXA precipitation",
      "JAXA 降水量"
    ),
  ];

  const jaxaImageTasks = [
    createJaxaTask(
      () => jaxa.getNdviImage(latitude, longitude, radiusM),
      jaxaImageTimeout,
      "JAXA NDVI image",
      "JAXA NDVI 可視化"
    ),
    createJaxaTask(
      () => jaxa.getLstImage(latitude, longitude, radiusM),
      jaxaImageTimeout,
      "JAXA LST image",
      "JAXA 温度可視化"
    ),
    createJaxaTask(
      () => jaxa.getPrecipitationImage(latitude, longitude),
      jaxaImageTimeout,
      "JAXA precipitation image",
      "JAXA 降水可視化"
    ),
  ];

  const jaxaTimeseriesTasks = [
    createJaxaTask(
      () => jaxa.getTimeseriesNdvi(latitude, longitude, radiusM, tsYears),
      timeseriesTimeout,
      "JAXA NDVI timeseries",
      "NDVI トレンド"
    ),
    createJaxaTask(
      () => jaxa.getTimeseriesLst(latitude, longitude, radiusM, tsYears),
      timeseriesTimeout,
      "JAXA LST timeseries",
      "温度トレンド"
    ),
    createJaxaTask(
      () => jaxa.getTimeseriesPrecipitation(latitude, longitude, tsYears),
      timeseriesTimeout,
      "JAXA precip timeseries",
      "降水トレンド"
    ),
  ];

  // Run all three JAXA groups concurrently (each group respects its own concurrency limit)
  const [jaxaStatsResults, jaxaImageResults, jaxaTimeseriesResults] = await Promise.all([
    allSettledWithConcurrency(jaxaStatsTasks, jaxaConcurrency),
    allSettledWithConcurrency(jaxaImageTasks, jaxaConcurrency),
    allSettledWithConcurrency(jaxaTimeseriesTasks, jaxaConcurrency),
  ]);

  const [elevationResult, ndviResult, lstResult, precipResult] = jaxaStatsResults;
  const [ndviImageResult, lstImageResult, precipImageResult] = jaxaImageResults;
  const [ndviTimeseriesResult, lstTimeseriesResult, precipTimeseriesResult] = jaxaTimeseriesResults;

  const [
    multiApiResult,
    dpfResult,
    landPriceHistoryResult,
  ] = await nonJaxaResultsPromise;

  // Process JAXA results
  const jaxaResults = {
    elevation: processResult(elevationResult, "JAXA", "elevation", citations, errors),
    ndvi: processResult(ndviResult, "JAXA", "NDVI", citations, errors),
    lst: processResult(lstResult, "JAXA", "LST", citations, errors),
    precipitation: processResult(precipResult, "JAXA", "precipitation", citations, errors),
    images: {
      ndvi: processResult(ndviImageResult, "JAXA", "NDVI image", citations, errors),
      lst: processResult(lstImageResult, "JAXA", "LST image", citations, errors),
      precipitation: processResult(precipImageResult, "JAXA", "precipitation image", citations, errors),
    },
    timeseriesData: {
      ndvi: processResult(ndviTimeseriesResult, "JAXA", "NDVI timeseries", citations, errors),
      lst: processResult(lstTimeseriesResult, "JAXA", "LST timeseries", citations, errors),
      precipitation: processResult(precipTimeseriesResult, "JAXA", "precipitation timeseries", citations, errors),
    },
  };

  // Process Geospatial results
  const geospatialResults: Record<string, unknown> = {};
  const multiApi = processGeospatialResult(
    multiApiResult,
    "MLIT Geospatial",
    "get_multi_api",
    citations,
    errors
  );
  if (multiApi && typeof multiApi === "object") {
    const multiApiRecord = multiApi as Record<string, unknown>;
    geospatialResults.multi_api = multiApiRecord;
    if (multiApiRecord["3"]) geospatialResults.land_price = multiApiRecord["3"];
    if (multiApiRecord["4"]) geospatialResults.urban_planning = multiApiRecord["4"];
    if (multiApiRecord["5"]) geospatialResults.zoning = multiApiRecord["5"];
  }
  const landPriceHistory = processGeospatialResult(
    landPriceHistoryResult,
    "MLIT Geospatial 地価履歴",
    "land_price_history",
    citations,
    errors
  );
  if (landPriceHistory) {
    geospatialResults.land_price_history = landPriceHistory;
  }

  // Process DPF results
  const dpfResults: Record<string, unknown> = {};
  const dpfSearch = processResult(dpfResult, "MLIT DPF", "search", citations, errors);
  if (dpfSearch) dpfResults.search_results = dpfSearch;

  return {
    result: {
      jaxa: jaxaResults,
      geospatial: geospatialResults,
      dpf: dpfResults,
      errors,
    },
    citations,
  };
}

function processResult<T>(
  result: PromiseSettledResult<T>,
  sourceName: string,
  toolName: string,
  citations: CitationTracker,
  errors: OrchestratorResult["errors"]
): T | null {
  if (result.status === "fulfilled") {
    if (result.value !== null && result.value !== undefined) {
      citations.addSource(sourceName, undefined, "success");
      return result.value;
    } else {
      citations.addSource(sourceName, undefined, "partial");
      return null;
    }
  } else {
    const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
    citations.addSource(sourceName, undefined, "failed");
    citations.addError(sourceName, toolName, message);
    errors.push({ source: sourceName, tool: toolName, message });
    return null;
  }
}

function processGeospatialResult<T>(
  result: PromiseSettledResult<GeospatialCallResult<T>>,
  sourceName: string,
  fallbackToolName: string,
  citations: CitationTracker,
  errors: OrchestratorResult["errors"]
): T | null {
  if (result.status === "fulfilled") {
    const callResult = result.value;

    for (const callError of callResult.errors) {
      citations.addError(sourceName, callError.tool || fallbackToolName, callError.message);
      errors.push({
        source: sourceName,
        tool: callError.tool || fallbackToolName,
        message: callError.message,
      });
    }

    if (callResult.data !== null && callResult.data !== undefined) {
      citations.addSource(
        sourceName,
        undefined,
        callResult.errors.length > 0 ? "partial" : "success"
      );
      return callResult.data;
    }

    citations.addSource(
      sourceName,
      undefined,
      callResult.errors.length > 0 ? "failed" : "partial"
    );
    return null;
  }

  const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
  citations.addSource(sourceName, undefined, "failed");
  citations.addError(sourceName, fallbackToolName, message);
  errors.push({ source: sourceName, tool: fallbackToolName, message });
  return null;
}
