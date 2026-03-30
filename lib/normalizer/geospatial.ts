import type { GeospatialResults } from "../mcp/types";
import { coerceNumericValue } from "../coerce-number";
import { extractLandPriceValue, extractLandPriceYear } from "../land-price";
import { pickString } from "../utils/strings";
import type { NormalizedGeospatial } from "./index";

export function normalizeGeospatial(raw: GeospatialResults): NormalizedGeospatial {
  const result: NormalizedGeospatial = {};

  // Process land price
  if (raw.land_price) {
    try {
      const data = raw.land_price as Record<string, unknown>;
      const features = extractFeatures(data);
      const points = features
        .map((feature) => extractLandPricePoint(feature))
        .filter((point): point is NonNullable<typeof point> => point !== null);
      if (points.length > 0) {
        result.land_price = { points };
      }
    } catch {
      // skip malformed data
    }
  }

  // Process urban planning
  if (raw.urban_planning) {
    try {
      const data = raw.urban_planning as Record<string, unknown>;
      const features = extractFeatures(data);
      if (features.length > 0) {
        const props = (features[0].properties || {}) as Record<string, unknown>;
        result.urban_planning = {
          area_class: String(props.area_class_name || props.区域区分名 || ""),
          description: String(props.description || ""),
        };
      }
    } catch {
      // skip
    }
  }

  if (raw.zoning) {
    try {
      const data = raw.zoning as Record<string, unknown>;
      const features = extractFeatures(data);
      if (features.length > 0) {
        const props = (features[0].properties || {}) as Record<string, unknown>;
        result.zoning = {
          name: String(props.用途地域名 || props.zoning_name || props.description || ""),
          description: String(props.description || ""),
        };
      }
    } catch {
      // skip
    }
  }

  // Process multi_api response (contains zoning, disaster, facilities, population etc.)
  if (raw.multi_api) {
    try {
      const multiData = raw.multi_api as Record<string, unknown>;

      // Extract facilities count
      const facilities: NormalizedGeospatial["facilities"] = {};
      if (multiData["9"]) facilities.schools = countFeatures(multiData["9"]);
      if (multiData["10"]) facilities.nurseries = countFeatures(multiData["10"]);
      if (multiData["11"]) facilities.hospitals = countFeatures(multiData["11"]);
      if (multiData["12"]) facilities.welfare = countFeatures(multiData["12"]);
      if (multiData["17"]) facilities.libraries = countFeatures(multiData["17"]);
      if (Object.keys(facilities).length > 0) result.facilities = facilities;

      // Extract zoning
      if (!result.zoning && multiData["5"]) {
        const features = extractFeatures(multiData["5"]);
        if (features.length > 0) {
          const props = (features[0].properties || {}) as Record<string, unknown>;
          result.zoning = {
            name: String(props.用途地域名 || props.zoning_name || ""),
            description: String(props.description || ""),
          };
        }
      }

      // Extract disaster info
      const disaster: NormalizedGeospatial["disaster"] = {};
      if (multiData["25"]) {
        const features = extractFeatures(multiData["25"]);
        disaster.liquefaction = { risk_level: extractLiquefactionRiskLevel(features) };
      }
      if (multiData["21"]) {
        const features = extractFeatures(multiData["21"]);
        disaster.landslide = { designated: features.length > 0 };
      }
      if (multiData["22"]) {
        const features = extractFeatures(multiData["22"]);
        disaster.steep_slope = { designated: features.length > 0 };
      }
      if (multiData["20"]) {
        const features = extractFeatures(multiData["20"]);
        disaster.large_fill = { designated: features.length > 0 };
      }
      if (multiData["16"]) {
        const features = extractFeatures(multiData["16"]);
        disaster.disaster_zone = { designated: features.length > 0 };
      }
      if (Object.keys(disaster).length > 0) result.disaster = disaster;

      // Extract population
      if (multiData["13"]) {
        const features = extractFeatures(multiData["13"]);
        if (features.length > 0) {
          const population = extractPopulation(features[0]);
          if (population) {
            result.population = population;
          }
        }
      }
    } catch {
      // skip
    }
  }

  // Process land price history
  if (raw.land_price_history && Array.isArray(raw.land_price_history)) {
    result.land_price_history = raw.land_price_history.map((p) => ({
      year: Number(p.year),
      price: Number(p.price),
      address: p.address ? String(p.address) : undefined,
    })).filter((p) => p.price > 0 && Number.isFinite(p.year));
  }

  return result;
}

function extractFeatures(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.features)) return obj.features as Array<Record<string, unknown>>;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  return [];
}

function countFeatures(data: unknown): number {
  return extractFeatures(data).length;
}

function extractLandPricePoint(feature: Record<string, unknown>): { price: number; address?: string; year?: number } | null {
  const props = (feature.properties || {}) as Record<string, unknown>;
  const price = extractLandPriceValue(props);

  if (price === undefined || price < 100) {
    return null;
  }

  return {
    price,
    address: pickString(props, ["location", "address", "L01_019", "residence_display_name_ja"]),
    year: extractLandPriceYear(props),
  };
}

function extractPopulation(feature: Record<string, unknown>): NormalizedGeospatial["population"] | null {
  const props = (feature.properties || {}) as Record<string, unknown>;
  const current = pickNumber(props, ["PTN_2020", "PT00_2025", "population", "PT0_2020"]);
  const forecast = pickNumber(props, ["PT00_2050", "PT00_2055", "PT00_2060", "PT00_2070", "PT0_2050"]);

  if (current === undefined && forecast === undefined) {
    return null;
  }

  return {
    current,
    forecast,
    year: current !== undefined && props.PTN_2020 !== undefined ? 2020 : 2025,
  };
}

function pickNumber(props: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = coerceNumericValue(props[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}


const LIQUEFACTION_RISK_MAP: Record<string, string> = {
  "大": "液状化の可能性が高い",
  "中": "液状化の可能性がある",
  "小": "液状化の可能性が低い",
};

function extractLiquefactionRiskLevel(features: Array<Record<string, unknown>>): string {
  if (features.length === 0) return "なし";

  for (const feature of features) {
    const props = (feature.properties || {}) as Record<string, unknown>;
    const raw = props.risk_level ?? props.リスクレベル ?? props.判定 ?? props.liquefaction_risk;
    if (typeof raw === "string" && raw.trim()) {
      const mapped = LIQUEFACTION_RISK_MAP[raw.trim()];
      if (mapped) return mapped;
      return raw.trim();
    }
  }

  return "液状化データあり（リスクレベル不明）";
}
