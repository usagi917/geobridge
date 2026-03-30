import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type {
  ProximityResult,
  MorphologyResult,
  IsochroneResult,
} from "../lib/city2graph/types";

// Will import after implementation
import { normalizeCity2Graph } from "../lib/normalizer/city2graph";

const validProximity: ProximityResult = {
  categories: {
    grocery: { facilities: [{ name: "Store", distance_m: 200, lat: 35.68, lon: 139.77, category: "grocery" }], count: 1 },
  },
  score: 78,
  total_pois: 42,
};

const validMorphology: MorphologyResult = {
  metrics: { building_count: 100, building_density_per_km2: 500, street_connectivity: 3.2, building_street_facing_ratio: 0.6 },
  maturity_score: 55,
};

const validIsochrone: IsochroneResult = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { threshold_seconds: 300, threshold_minutes: 5 },
    geometry: { type: "Polygon", coordinates: [[[139.76, 35.68], [139.77, 35.68], [139.77, 35.69], [139.76, 35.68]]] },
  }],
};

describe("normalizeCity2Graph", () => {
  test("clamps proximity score above 100 to 100", () => {
    const raw = { proximity: { ...validProximity, score: 150 }, morphology: null, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.proximity?.score, 100);
  });

  test("clamps proximity score below 0 to 0", () => {
    const raw = { proximity: { ...validProximity, score: -10 }, morphology: null, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.proximity?.score, 0);
  });

  test("clamps maturity_score above 100 to 100", () => {
    const raw = { proximity: null, morphology: { ...validMorphology, maturity_score: 120 }, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.morphology?.maturity_score, 100);
  });

  test("clamps maturity_score below 0 to 0", () => {
    const raw = { proximity: null, morphology: { ...validMorphology, maturity_score: -5 }, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.morphology?.maturity_score, 0);
  });

  test("omits isochrone with empty features", () => {
    const raw = { proximity: null, morphology: null, isochrone: { type: "FeatureCollection" as const, features: [] } };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.isochrone, undefined);
  });

  test("passes through valid isochrone", () => {
    const raw = { proximity: null, morphology: null, isochrone: validIsochrone };
    const result = normalizeCity2Graph(raw);
    assert.ok(result.isochrone);
    assert.equal(result.isochrone.features.length, 1);
  });

  test("passes through valid proximity unchanged", () => {
    const raw = { proximity: validProximity, morphology: null, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.deepEqual(result.proximity?.categories, validProximity.categories);
  });

  test("passes through valid morphology unchanged", () => {
    const raw = { proximity: null, morphology: validMorphology, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.morphology?.maturity_score, 55);
  });

  test("handles all-null input", () => {
    const raw = { proximity: null, morphology: null, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.proximity, undefined);
    assert.equal(result.morphology, undefined);
    assert.equal(result.isochrone, undefined);
  });

  test("handles proximity=null", () => {
    const raw = { proximity: null, morphology: validMorphology, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.proximity, undefined);
    assert.ok(result.morphology);
  });

  test("handles morphology=null", () => {
    const raw = { proximity: validProximity, morphology: null, isochrone: null };
    const result = normalizeCity2Graph(raw);
    assert.equal(result.morphology, undefined);
    assert.ok(result.proximity);
  });
});
