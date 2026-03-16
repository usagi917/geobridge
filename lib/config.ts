const perspectives = ["comprehensive", "child_rearing", "disaster", "livability"] as const;

export type Perspective = (typeof perspectives)[number];

function getEnvNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const CONFIG = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "qwen3.5:35b-a3b",
    timeout: getEnvNumber(process.env.OLLAMA_TIMEOUT_MS, 180_000),
    maxTokens: getEnvNumber(process.env.OLLAMA_MAX_TOKENS, 1536),
  },
  openai: {
    model: process.env.OPENAI_MODEL || "gpt-4o",
    timeout: getEnvNumber(process.env.OPENAI_TIMEOUT_MS, 60_000),
    maxTokens: getEnvNumber(process.env.OPENAI_MAX_TOKENS, 1536),
  },
  mcp: {
    jaxa: {
      command: "uv",
      args: ["run", "--directory", "./mcp-servers/jaxa", "python", "mcp_server.py"],
    },
    geospatial: {
      command: "uv",
      args: ["run", "--directory", "./mcp-servers/geospatial", "python", "src/server.py"],
    },
    dpf: {
      command: "uv",
      args: ["run", "--directory", "./mcp-servers/dpf", "python", "src/server.py"],
    },
    toolTimeout: 15_000,
    jaxaStatsTimeout: getEnvNumber(process.env.JAXA_STATS_TIMEOUT_MS, 60_000),
    jaxaImageTimeout: getEnvNumber(process.env.JAXA_IMAGE_TIMEOUT_MS, 90_000),
    jaxaConcurrency: Math.max(1, getEnvNumber(process.env.JAXA_CONCURRENCY, 2)),
    jaxaRetryCount: Math.max(0, getEnvNumber(process.env.JAXA_RETRY_COUNT, 1)),
    jaxaMonthlyLagMonths: Math.max(1, getEnvNumber(process.env.JAXA_MONTHLY_LAG_MONTHS, 2)),
    timeseriesTimeout: 60_000,
    landPriceHistoryConcurrency: getEnvNumber(process.env.MLIT_LAND_PRICE_HISTORY_CONCURRENCY, 3),
  },
  geocode: {
    baseUrl: "https://msearch.gsi.go.jp/address-search/AddressSearch",
  },
  report: {
    defaultRadius: 400,
    maxRadius: 400,
    jaxaTimeseriesYears: 5,
    landPriceHistoryYears: 10,
    // Keep in sync with the bundled geospatial MCP server's supported latest survey year.
    landPriceLatestYear: 2025,
  },
  perspectives,
  perspectiveApiMap: {
    comprehensive: [3, 4, 5, 6, 10, 11, 12, 13, 14, 19, 21, 22, 23, 24, 25],
    child_rearing: [10, 11, 12, 13, 14, 15, 16, 19, 20],
    disaster: [21, 22, 23, 24, 25, 4, 5],
    livability: [3, 5, 10, 11, 12, 13, 14, 16, 17, 18, 19],
  },
};
