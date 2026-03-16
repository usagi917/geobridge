import assert from "node:assert/strict";
import test from "node:test";
import { parseLandPriceValue } from "../lib/land-price";
import { buildMonthlyTimeseriesPoints } from "../lib/monthly-timeseries";
import {
  convertMonthlyRateStatsToAccumulation,
  convertMonthlyRateTimeseriesToAccumulation,
  getMonthlyHoursFromRange,
} from "../lib/precipitation";

test("parseLandPriceValue keeps full yen values from localized MLIT strings", () => {
  assert.equal(parseLandPriceValue("241,000(円/㎡)"), 241000);
  assert.equal(parseLandPriceValue("3,100,000(円/㎡)"), 3100000);
});

test("buildMonthlyTimeseriesPoints flattens nested JAXA arrays", () => {
  const points = buildMonthlyTimeseriesPoints(
    {
      mean: [[0.03606259], [0.03870392]],
      min: [[0.03266334], [0.03356275]],
      max: [[0.03945996], [0.04351521]],
    },
    2025
  );

  assert.deepEqual(points, [
    { date: "2025-01", mean: 0.03606259, min: 0.03266334, max: 0.03945996 },
    { date: "2025-02", mean: 0.03870392, min: 0.03356275, max: 0.04351521 },
  ]);
});

test("convertMonthlyRateStatsToAccumulation converts mm/hr to monthly totals", () => {
  assert.equal(getMonthlyHoursFromRange(["2026-01-01T00:00:00", "2026-01-31T23:59:59"]), 744);

  const converted = convertMonthlyRateStatsToAccumulation(
    {
      mean: 0.0130447,
      min: 0.00527712,
      max: 0.02197073,
    },
    ["2026-01-01T00:00:00", "2026-01-31T23:59:59"]
  );

  assert.deepEqual(converted, {
    mean: 9.7053,
    min: 3.9262,
    max: 16.3462,
    std: undefined,
    median: undefined,
    unit: "mm",
  });
});

test("convertMonthlyRateTimeseriesToAccumulation converts each month using its own duration", () => {
  const converted = convertMonthlyRateTimeseriesToAccumulation({
    unit: "mm/hr",
    points: [
      { date: "2025-02", mean: 0.03870392, min: 0.03356275, max: 0.04351521 },
      { date: "2025-03", mean: 0.13562547 },
    ],
  });

  assert.deepEqual(converted, {
    unit: "mm/月",
    points: [
      { date: "2025-02", mean: 26.009, min: 22.5542, max: 29.2422 },
      { date: "2025-03", mean: 100.9053, min: undefined, max: undefined },
    ],
  });
});
