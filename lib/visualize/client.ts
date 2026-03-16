import { spawn } from "child_process";
import type { GeneratedChart, JaxaVisualization } from "../report/schema";

export type { GeneratedChart } from "../report/schema";

export interface GeneratedMap {
  id: string;
  imageDataUrl: string;
}

interface VisualizeMapInput {
  id: string;
  title: string;
  imageDataUrl: string;
  bbox: [number, number, number, number];
  center: [number, number];
  min?: number;
  max?: number;
  unit?: string;
}

interface VisualizeLineChartInput {
  id: string;
  title: string;
  description?: string;
  unit: string;
  points: Array<{ label: string; value: number }>;
}

interface VisualizeResult {
  maps?: GeneratedMap[];
  charts?: GeneratedChart[];
}

async function runVisualizer(payload: Record<string, unknown>): Promise<VisualizeResult> {
  return new Promise<VisualizeResult>((resolve) => {
    const child = spawn("uv", ["run", "--directory", "./lib/visualize", "python", "generate.py"], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
      env: {
        ...process.env,
        MPLCONFIGDIR: process.env.MPLCONFIGDIR || "/tmp/terrascore-matplotlib",
        XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || "/tmp/terrascore-cache",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      console.error("[visualize] spawn error:", err.message);
      resolve({});
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`[visualize] exited with code ${code}`, stderr);
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(stdout) as VisualizeResult);
      } catch (e) {
        console.error("[visualize] failed to parse output:", e);
        resolve({});
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function generateMapImages(
  visualizations: JaxaVisualization[],
  center: [number, number]
): Promise<GeneratedMap[]> {
  if (visualizations.length === 0) return [];

  const input: VisualizeMapInput[] = visualizations.map((v) => ({
    id: v.id,
    title: v.title,
    imageDataUrl: v.imageDataUrl,
    bbox: v.bbox,
    center,
    min: v.min,
    max: v.max,
    unit: v.unit,
  }));
  const result = await runVisualizer({ visualizations: input });
  return result.maps ?? [];
}

export async function generateLineChartImages(
  charts: VisualizeLineChartInput[]
): Promise<GeneratedChart[]> {
  if (charts.length === 0) return [];

  const result = await runVisualizer({ charts });
  return result.charts ?? [];
}
