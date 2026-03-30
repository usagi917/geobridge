import assert from "node:assert/strict";
import test from "node:test";
import { normalizeJaxa } from "../lib/normalizer/jaxa";

test("normalizeJaxa converts Kelvin LST inputs to Celsius across stats, charts, and timeseries", () => {
  const normalized = normalizeJaxa({
    lst: {
      mean: 274.715,
      min: 270.15,
      max: 280.15,
      unit: "K",
    },
    images: {
      lst: {
        id: "lst",
        title: "地表面温度",
        description: "test",
        imageDataUrl: "data:image/png;base64,abc",
        bbox: [139, 35, 140, 36],
        capturedRange: ["2025-02-01T00:00:00", "2025-02-28T23:59:59"],
      },
    },
    timeseriesData: {
      lst: {
        unit: "K",
        points: [
          { date: "2025-02", mean: 274.715, min: 270.15, max: 280.15 },
        ],
      },
    },
  });

  assert.equal(normalized.lst?.unit, "°C");
  assert.equal(normalized.lst?.mean?.toFixed(3), "1.565");
  assert.equal(normalized.lst?.min?.toFixed(2), "-3.00");
  assert.equal(normalized.lst?.max?.toFixed(2), "7.00");
  assert.equal(normalized.visualizations?.[0]?.valueLabel, "平均 1.6°C");
  assert.equal(normalized.timeseries?.lst?.unit, "°C");
  assert.equal(normalized.timeseries?.lst?.data[0]?.mean.toFixed(3), "1.565");
});

test("normalizeJaxa keeps Celsius LST inputs as Celsius when upstream already converted them", () => {
  const normalized = normalizeJaxa({
    lst: {
      mean: 18.5,
      min: 14.2,
      max: 23.9,
      unit: "°C",
    },
    timeseriesData: {
      lst: {
        points: [
          { date: "2025-07", mean: 18.5, min: 14.2, max: 23.9 },
        ],
      },
    },
  });

  assert.equal(normalized.lst?.mean, 18.5);
  assert.equal(normalized.lst?.min, 14.2);
  assert.equal(normalized.lst?.max, 23.9);
  assert.equal(normalized.timeseries?.lst?.data[0]?.mean, 18.5);
});
