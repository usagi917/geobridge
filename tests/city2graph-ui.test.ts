import assert from "node:assert/strict";
import test, { describe } from "node:test";

// --- 0-1. カラー定数テスト ---

import {
  ISOCHRONE_COLORS,
  CATEGORY_COLORS,
  MORPHOLOGY_COLORS,
} from "../lib/city2graph/colors";

describe("colors.ts", () => {
  test("ISOCHRONE_COLORS has keys 5, 10, 15", () => {
    assert.deepEqual(Object.keys(ISOCHRONE_COLORS).sort(), ["10", "15", "5"]);
  });

  test("ISOCHRONE_COLORS values are hex strings", () => {
    for (const color of Object.values(ISOCHRONE_COLORS)) {
      assert.match(color, /^#[0-9a-fA-F]{6}$/);
    }
  });

  test("CATEGORY_COLORS has all 6 POI categories", () => {
    const expected = ["convenience", "grocery", "hospital", "park", "restaurant", "school"];
    assert.deepEqual(Object.keys(CATEGORY_COLORS).sort(), expected);
  });

  test("CATEGORY_COLORS values are hex strings", () => {
    for (const color of Object.values(CATEGORY_COLORS)) {
      assert.match(color, /^#[0-9a-fA-F]{6}$/);
    }
  });

  test("MORPHOLOGY_COLORS has 3 metrics", () => {
    const expected = ["connectivity", "density", "facing"];
    assert.deepEqual(Object.keys(MORPHOLOGY_COLORS).sort(), expected);
  });

  test("MORPHOLOGY_COLORS values are hex strings", () => {
    for (const color of Object.values(MORPHOLOGY_COLORS)) {
      assert.match(color, /^#[0-9a-fA-F]{6}$/);
    }
  });
});

// --- 0-2. カテゴリマスタテスト ---

import { CATEGORIES, type CategoryKey } from "../lib/city2graph/categories";

describe("categories.ts", () => {
  const expectedKeys: CategoryKey[] = [
    "grocery", "hospital", "school", "convenience", "park", "restaurant",
  ];

  test("CATEGORIES has all 6 categories", () => {
    assert.deepEqual(
      CATEGORIES.map((c) => c.key).sort(),
      [...expectedKeys].sort(),
    );
  });

  test("each category has label, icon, colorKey", () => {
    for (const cat of CATEGORIES) {
      assert.ok(cat.label, `${cat.key} has label`);
      assert.ok(cat.icon, `${cat.key} has icon`);
      assert.ok(cat.colorKey, `${cat.key} has colorKey`);
    }
  });

  test("colorKey matches CATEGORY_COLORS keys", () => {
    for (const cat of CATEGORIES) {
      assert.ok(
        cat.key in CATEGORY_COLORS,
        `${cat.key} exists in CATEGORY_COLORS`,
      );
    }
  });
});

// --- 0-3. Morphology 基準値レンジ・正規化テスト ---

import {
  MORPHOLOGY_RANGES,
  normalizeMetric,
  getMetricLevel,
} from "../lib/city2graph/constants";

describe("constants.ts", () => {
  test("MORPHOLOGY_RANGES has 3 metrics", () => {
    assert.ok(MORPHOLOGY_RANGES.building_density_per_km2);
    assert.ok(MORPHOLOGY_RANGES.street_connectivity);
    assert.ok(MORPHOLOGY_RANGES.building_street_facing_ratio);
  });

  test("each range has min and max", () => {
    for (const range of Object.values(MORPHOLOGY_RANGES)) {
      assert.equal(typeof range.min, "number");
      assert.equal(typeof range.max, "number");
      assert.ok(range.max > range.min, "max > min");
    }
  });

  describe("normalizeMetric", () => {
    const range = { min: 0, max: 100 };

    test("returns 0 for value at min", () => {
      assert.equal(normalizeMetric(0, range), 0);
    });

    test("returns 1 for value at max", () => {
      assert.equal(normalizeMetric(100, range), 1);
    });

    test("returns 0.5 for midpoint", () => {
      assert.equal(normalizeMetric(50, range), 0.5);
    });

    test("clamps below min to 0", () => {
      assert.equal(normalizeMetric(-10, range), 0);
    });

    test("clamps above max to 1", () => {
      assert.equal(normalizeMetric(200, range), 1);
    });

    test("works with non-zero min", () => {
      const r = { min: 1, max: 5 };
      assert.equal(normalizeMetric(3, r), 0.5);
      assert.equal(normalizeMetric(0, r), 0);
      assert.equal(normalizeMetric(6, r), 1);
    });
  });

  describe("getMetricLevel", () => {
    test("returns 低 for low values", () => {
      assert.equal(getMetricLevel(0.2), "低");
    });

    test("returns 中 for mid values", () => {
      assert.equal(getMetricLevel(0.5), "中");
    });

    test("returns 高 for high values", () => {
      assert.equal(getMetricLevel(0.8), "高");
    });

    test("boundary: 1/3 is 中", () => {
      assert.equal(getMetricLevel(1 / 3), "中");
    });

    test("boundary: 2/3 is 高", () => {
      assert.equal(getMetricLevel(2 / 3), "高");
    });
  });
});

// --- 0-5. データ状態判定テスト ---

import {
  getCategoryStatus,
  hasAnyCity2GraphData,
} from "../lib/city2graph/data-status";
import type { City2GraphResults, ProximityCategory } from "../lib/city2graph/types";

describe("data-status", () => {
  describe("getCategoryStatus", () => {
    test("returns available when facilities exist", () => {
      const cat: ProximityCategory = {
        facilities: [{ name: "Store", distance_m: 200, lat: 35.68, lon: 139.77, category: "grocery" }],
        count: 1,
      };
      assert.equal(getCategoryStatus(cat), "available");
    });

    test("returns empty when facilities is empty array and count is 0", () => {
      const cat: ProximityCategory = { facilities: [], count: 0 };
      assert.equal(getCategoryStatus(cat), "empty");
    });

    test("returns unavailable when null", () => {
      assert.equal(getCategoryStatus(null), "unavailable");
    });

    test("returns unavailable when undefined", () => {
      assert.equal(getCategoryStatus(undefined), "unavailable");
    });
  });

  describe("hasAnyCity2GraphData", () => {
    test("returns true when proximity exists", () => {
      const results: City2GraphResults = {
        proximity: { categories: {}, score: 0, total_pois: 0 },
        morphology: null,
        isochrone: null,
      };
      assert.equal(hasAnyCity2GraphData(results), true);
    });

    test("returns true when morphology exists", () => {
      const results: City2GraphResults = {
        proximity: null,
        morphology: {
          metrics: { building_count: 0, building_density_per_km2: 0, street_connectivity: 0, building_street_facing_ratio: 0 },
          maturity_score: 0,
        },
        isochrone: null,
      };
      assert.equal(hasAnyCity2GraphData(results), true);
    });

    test("returns true when isochrone exists", () => {
      const results: City2GraphResults = {
        proximity: null,
        morphology: null,
        isochrone: { type: "FeatureCollection", features: [] },
      };
      assert.equal(hasAnyCity2GraphData(results), true);
    });

    test("returns false when all null", () => {
      const results: City2GraphResults = {
        proximity: null,
        morphology: null,
        isochrone: null,
      };
      assert.equal(hasAnyCity2GraphData(results), false);
    });
  });
});
