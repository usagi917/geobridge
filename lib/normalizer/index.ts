import { normalizeJaxa } from "./jaxa";
import { normalizeGeospatial } from "./geospatial";
import { normalizeDpf } from "./dpf";
import { normalizeCity2Graph, type NormalizedCity2Graph } from "./city2graph";
import type { OrchestratorResult } from "../mcp/types";
import type { ReportInput } from "../report/schema";
import type { JaxaVisualization } from "../report/schema";

export interface TimeseriesDataPoint {
  date: string;
  mean: number;
  min?: number;
  max?: number;
}

export interface NormalizedTimeseriesEntry {
  label: string;
  unit: string;
  data: TimeseriesDataPoint[];
}

export interface NormalizedJaxa {
  elevation?: { mean?: number; min?: number; max?: number; unit: string };
  ndvi?: { mean?: number; min?: number; max?: number; description: string };
  lst?: { mean?: number; min?: number; max?: number; unit: string };
  precipitation?: { mean?: number; unit: string };
  visualizations?: JaxaVisualization[];
  timeseries?: {
    ndvi?: NormalizedTimeseriesEntry;
    lst?: NormalizedTimeseriesEntry;
    precipitation?: NormalizedTimeseriesEntry;
  };
}

export interface NormalizedGeospatial {
  land_price?: { points: Array<{ price: number; address?: string; year?: number }> };
  zoning?: { name?: string; description?: string };
  urban_planning?: { area_class?: string; description?: string };
  disaster?: {
    liquefaction?: { risk_level?: string };
    landslide?: { designated?: boolean };
    steep_slope?: { designated?: boolean };
    large_fill?: { designated?: boolean };
    disaster_zone?: { designated?: boolean };
  };
  facilities?: {
    schools?: number;
    hospitals?: number;
    nurseries?: number;
    libraries?: number;
    welfare?: number;
  };
  population?: { current?: number; forecast?: number; year?: number };
  land_price_history?: Array<{ year: number; price: number; address?: string }>;
}

export interface NormalizedDpf {
  related_data?: Array<{ title: string; description?: string }>;
}

export interface NormalizedData {
  input?: ReportInput;
  jaxa?: NormalizedJaxa;
  geospatial?: NormalizedGeospatial;
  dpf?: NormalizedDpf;
  city2graph?: NormalizedCity2Graph;
}

export function normalizeAll(
  orchestratorResult: OrchestratorResult,
  input: ReportInput
): NormalizedData {
  return {
    input,
    jaxa: normalizeJaxa(orchestratorResult.jaxa),
    geospatial: normalizeGeospatial(orchestratorResult.geospatial),
    dpf: normalizeDpf(orchestratorResult.dpf),
    city2graph: orchestratorResult.city2graph
      ? normalizeCity2Graph(orchestratorResult.city2graph)
      : undefined,
  };
}
