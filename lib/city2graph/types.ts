// ── Proximity (生活利便ネットワーク) ──

export interface ProximityFacility {
  name: string;
  distance_m: number;
  lat: number;
  lon: number;
  category: string;
}

export interface ProximityCategory {
  facilities: ProximityFacility[];
  count: number;
}

export interface ProximityResult {
  categories: Record<string, ProximityCategory>;
  score: number;
  total_pois: number;
}

// ── Morphology (街区構造スコア) ──

export interface MorphologyMetrics {
  building_count: number;
  building_density_per_km2: number;
  street_connectivity: number;
  building_street_facing_ratio: number;
}

export interface MorphologyResult {
  metrics: MorphologyMetrics;
  maturity_score: number;
}

// ── Isochrone (徒歩圏マップ) ──

export interface IsochroneFeatureProperties {
  threshold_seconds: number;
  threshold_minutes: number;
}

export interface IsochroneFeature {
  type: "Feature";
  properties: IsochroneFeatureProperties;
  geometry: Record<string, unknown>;
}

export interface IsochroneResult {
  type: "FeatureCollection";
  features: IsochroneFeature[];
}

// ── Aggregate ──

export interface City2GraphResults {
  proximity: ProximityResult | null;
  morphology: MorphologyResult | null;
  isochrone: IsochroneResult | null;
}
