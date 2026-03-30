import { z } from "zod";
import { coerceNumericValue } from "../coerce-number";

export const sourceSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  fetched_at: z.string(),
  status: z.enum(["success", "partial", "failed"]),
  count: z.number().int().min(1).default(1),
});

export const errorEntrySchema = z.object({
  source: z.string(),
  tool: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

export const sectionContentSchema = z.object({
  facts: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  data: z.record(z.unknown()).optional(),
});

const numericLikeSchema = z.preprocess((value) => {
  const coerced = coerceNumericValue(value);
  return coerced ?? value;
}, z.number().finite());

const summaryMetricSchema = z.object({
  mean: numericLikeSchema.optional(),
  min: numericLikeSchema.optional(),
  max: numericLikeSchema.optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

const landPricePointSchema = z.object({
  price: numericLikeSchema.optional(),
  address: z.string().optional(),
  year: numericLikeSchema.optional(),
}).passthrough();

const jaxaVisualizationSchema = z.object({
  id: z.enum(["ndvi", "lst", "precipitation"]),
  title: z.string(),
  description: z.string(),
  imageDataUrl: z.string(),
  bbox: z.tuple([numericLikeSchema, numericLikeSchema, numericLikeSchema, numericLikeSchema]),
  capturedRange: z.tuple([z.string(), z.string()]),
  mean: numericLikeSchema.optional(),
  min: numericLikeSchema.optional(),
  max: numericLikeSchema.optional(),
  unit: z.string().optional(),
  valueLabel: z.string().optional(),
}).passthrough();

const generatedMapSchema = z.object({
  id: z.string(),
  imageDataUrl: z.string(),
});

const generatedChartSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  imageDataUrl: z.string(),
});

const generatedGraphSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  imageDataUrl: z.string(),
});

const timeseriesDataPointSchema = z.object({
  date: z.string(),
  mean: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const normalizedTimeseriesSchema = z.object({
  label: z.string(),
  unit: z.string(),
  data: z.array(timeseriesDataPointSchema),
});

const annualPrecipitationPointSchema = z.object({
  year: numericLikeSchema,
  total: numericLikeSchema,
});

const annualPrecipitationSchema = z.object({
  label: z.string(),
  unit: z.string(),
  data: z.array(annualPrecipitationPointSchema),
});

const landPriceHistoryPointSchema = z.object({
  year: numericLikeSchema,
  price: numericLikeSchema,
  address: z.string().optional(),
});

const proximityFacilitySchema = z.object({
  name: z.string(),
  distance_m: z.number().min(0),
  lat: z.number(),
  lon: z.number(),
  category: z.string(),
});

const proximityCategorySchema = z.object({
  facilities: z.array(proximityFacilitySchema),
  count: z.number().int().min(0),
});

const proximityResultSchema = z.object({
  categories: z.record(proximityCategorySchema),
  score: z.number().min(0).max(100),
  total_pois: z.number().int().min(0),
});

const morphologyMetricsSchema = z.object({
  building_count: z.number().int().min(0),
  building_density_per_km2: z.number().min(0),
  street_connectivity: z.number().min(0),
  building_street_facing_ratio: z.number().min(0).max(1),
});

const morphologyResultSchema = z.object({
  metrics: morphologyMetricsSchema,
  maturity_score: z.number().min(0).max(100),
});

const isochroneResultSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.object({
    type: z.literal("Feature"),
    properties: z.object({
      threshold_seconds: z.number(),
      threshold_minutes: z.number(),
    }),
    geometry: z.record(z.unknown()),
  })),
});

const summaryDataSchema = z.object({
  elevation: summaryMetricSchema.optional(),
  ndvi: summaryMetricSchema.optional(),
  lst: summaryMetricSchema.optional(),
  precipitation: summaryMetricSchema.optional(),
  land_price: z.object({
    points: z.array(landPricePointSchema).default([]),
  }).passthrough().optional(),
  perspective: z.string().optional(),
  visualizations: z.array(jaxaVisualizationSchema).default([]).optional(),
  generated_maps: z.array(generatedMapSchema).default([]).optional(),
  generated_charts: z.array(generatedChartSchema).default([]).optional(),
  generated_graphs: z.array(generatedGraphSchema).default([]).optional(),
  timeseries: z.object({
    ndvi: normalizedTimeseriesSchema.optional(),
    lst: normalizedTimeseriesSchema.optional(),
    precipitation: normalizedTimeseriesSchema.optional(),
  }).optional(),
  annual_precipitation: annualPrecipitationSchema.optional(),
  land_price_history: z.array(landPriceHistoryPointSchema).optional(),
  proximity: proximityResultSchema.optional(),
  morphology: morphologyResultSchema.optional(),
  isochrone: isochroneResultSchema.optional(),
}).passthrough();

const summarySectionContentSchema = sectionContentSchema.extend({
  data: summaryDataSchema.optional(),
});

export const reportInputSchema = z.object({
  address: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_m: z.number().int().min(1).max(400).default(400),
  perspective: z.enum(["comprehensive", "child_rearing", "disaster", "livability"]).default("comprehensive"),
});

export const analysisJobSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  input: reportInputSchema,
  progress: z.array(z.string()).default([]),
  report_id: z.string().uuid().optional(),
  error_message: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reportSchema = z.object({
  id: z.string().uuid(),
  input: reportInputSchema,
  sections: z.object({
    summary: summarySectionContentSchema,
    disaster_safety: sectionContentSchema,
    livability: sectionContentSchema,
    environment: sectionContentSchema,
    regional_context: sectionContentSchema,
    data_gaps: sectionContentSchema,
  }),
  sources: z.array(sourceSchema),
  errors: z.array(errorEntrySchema),
  generated_at: z.string(),
  llm_model: z.string(),
  generation_time_ms: z.number(),
});

export type Report = z.infer<typeof reportSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;
export type AnalysisJob = z.infer<typeof analysisJobSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type ErrorEntry = z.infer<typeof errorEntrySchema>;
export type SectionContent = z.infer<typeof sectionContentSchema>;
export type SummaryData = z.infer<typeof summaryDataSchema>;
export type JaxaVisualization = z.infer<typeof jaxaVisualizationSchema>;
export type GeneratedMap = z.infer<typeof generatedMapSchema>;
export type GeneratedChart = z.infer<typeof generatedChartSchema>;
export type GeneratedGraph = z.infer<typeof generatedGraphSchema>;
