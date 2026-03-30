import { spawn } from "child_process";
import type { GeneratedGraph } from "../report/schema";

export interface GraphGenerationInput {
  latitude: number;
  longitude: number;
  radius_m: number;
  graphs?: string[];
}

interface GraphGenerationResult {
  graphs?: GeneratedGraph[];
}

export async function generateGraphImages(
  input: GraphGenerationInput
): Promise<GeneratedGraph[]> {
  const payload = {
    latitude: input.latitude,
    longitude: input.longitude,
    radius_m: input.radius_m,
    graphs: input.graphs ?? ["morphology", "proximity", "road_centrality"],
  };

  return new Promise<GeneratedGraph[]>((resolve) => {
    const child = spawn(
      "uv",
      ["run", "--directory", "./lib/visualize", "python", "generate_graphs.py"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60_000,
        env: {
          ...process.env,
          MPLCONFIGDIR: process.env.MPLCONFIGDIR || "/tmp/terrascore-matplotlib",
          XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || "/tmp/terrascore-cache",
        },
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      console.error("[graph] spawn error:", err.message);
      resolve([]);
    });

    child.on("close", (code) => {
      if (stderr) {
        console.log("[graph] stderr:", stderr.trim());
      }

      if (code !== 0) {
        console.error(`[graph] exited with code ${code}`);
        resolve([]);
        return;
      }

      try {
        const result = JSON.parse(stdout) as GraphGenerationResult;
        resolve(result.graphs ?? []);
      } catch (e) {
        console.error("[graph] failed to parse output:", e);
        resolve([]);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
