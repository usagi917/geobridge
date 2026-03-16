export interface McpTextContent {
  type: "text";
  text?: string;
}

export interface McpImageContent {
  type: "image";
  data?: string;
  mimeType?: string;
}

export interface McpUnknownContent {
  type: string;
  [key: string]: unknown;
}

export interface McpToolResult {
  content: Array<McpTextContent | McpImageContent | McpUnknownContent>;
  isError?: boolean;
}

export function getTextFromToolResult(result: McpToolResult): string | undefined {
  const textContent = result.content.find(
    (content): content is McpTextContent =>
      content.type === "text" && typeof content.text === "string"
  );
  return textContent?.text;
}

export interface JaxaSpatialStats {
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  median?: number;
  unit?: string;
}

export type JaxaVisualizationId = "ndvi" | "lst" | "precipitation";

export interface JaxaLayerImage {
  id: JaxaVisualizationId;
  title: string;
  description: string;
  imageDataUrl: string;
  bbox: [number, number, number, number];
  capturedRange: [string, string];
}

export interface JaxaTimeseriesPoint {
  date: string;       // "YYYY-MM"
  mean: number;
  min?: number;
  max?: number;
}

export interface JaxaTimeseries {
  points: JaxaTimeseriesPoint[];
  unit?: string;
}

export interface LandPriceHistoryPoint {
  year: number;
  price: number;
  address?: string;
}

export interface GeospatialToolError {
  tool: string;
  message: string;
}

export interface GeospatialCallResult<T> {
  data: T | null;
  errors: GeospatialToolError[];
}

export interface JaxaResults {
  elevation?: JaxaSpatialStats | null;
  ndvi?: JaxaSpatialStats | null;
  lst?: JaxaSpatialStats | null;
  precipitation?: JaxaSpatialStats | null;
  images?: {
    ndvi?: JaxaLayerImage | null;
    lst?: JaxaLayerImage | null;
    precipitation?: JaxaLayerImage | null;
  };
  timeseriesData?: {
    ndvi?: JaxaTimeseries | null;
    lst?: JaxaTimeseries | null;
    precipitation?: JaxaTimeseries | null;
  };
}

export interface GeospatialResults {
  land_price?: unknown;
  urban_planning?: unknown;
  zoning?: unknown;
  multi_api?: unknown;
  land_price_history?: LandPriceHistoryPoint[] | null;
}

export interface DpfResults {
  search_results?: unknown;
}

export interface OrchestratorResult {
  jaxa: JaxaResults;
  geospatial: GeospatialResults;
  dpf: DpfResults;
  errors: Array<{ source: string; tool: string; message: string }>;
}

export function createBbox(lat: number, lon: number, radiusM: number = 400): [number, number, number, number] {
  const latDelta = radiusM / 111320;
  const lonDelta = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  // JAXA API requires at least 0.01 degree difference per axis
  const minDelta = 0.005;
  const effLatDelta = Math.max(latDelta, minDelta);
  const effLonDelta = Math.max(lonDelta, minDelta);
  return [
    lon - effLonDelta,
    lat - effLatDelta,
    lon + effLonDelta,
    lat + effLatDelta,
  ];
}
