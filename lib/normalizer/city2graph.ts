import type {
  City2GraphResults,
  ProximityResult,
  MorphologyResult,
  IsochroneResult,
} from "../city2graph/types";

export interface NormalizedCity2Graph {
  proximity?: ProximityResult;
  morphology?: MorphologyResult;
  isochrone?: IsochroneResult;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCity2Graph(raw: City2GraphResults): NormalizedCity2Graph {
  const result: NormalizedCity2Graph = {};

  if (raw.proximity) {
    result.proximity = {
      ...raw.proximity,
      score: clamp(raw.proximity.score, 0, 100),
    };
  }

  if (raw.morphology) {
    result.morphology = {
      ...raw.morphology,
      maturity_score: clamp(raw.morphology.maturity_score, 0, 100),
    };
  }

  if (raw.isochrone && raw.isochrone.features.length > 0) {
    result.isochrone = raw.isochrone;
  }

  return result;
}
