import { spawn } from "child_process";
import { CONFIG } from "../config";
import type {
  IsochroneResult,
  MorphologyResult,
  ProximityResult,
} from "./types";

interface City2GraphPayload {
  type: string;
  latitude: number;
  longitude: number;
  radius_m?: number;
  thresholds?: readonly number[];
}

async function runCity2Graph<T>(payload: City2GraphPayload): Promise<T | null> {
  if (!CONFIG.city2graph.enabled) return null;

  return new Promise<T | null>((resolve, reject) => {
    const child = spawn(
      "uv",
      ["run", "--directory", "./lib/city2graph", "python", "analyze.py"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: CONFIG.city2graph.timeout,
        env: {
          ...process.env,
          XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || "/tmp/terrascore-cache",
        },
      },
    );

    const MAX_STDOUT_BYTES = 10 * 1024 * 1024; // 10 MB
    let stdout = "";
    let stderr = "";
    let killed = false;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > MAX_STDOUT_BYTES && !killed) {
        killed = true;
        child.kill("SIGTERM");
        reject(new Error("city2graph output exceeded 10 MB limit"));
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      console.error("[city2graph] spawn error:", err.message);
      if (!child.killed) child.kill();
      reject(new Error(`city2graph spawn failed: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`[city2graph] exited with code ${code}`, stderr);
        reject(new Error(`city2graph exited with code ${code}: ${stderr.slice(0, 200)}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as Record<string, unknown>;
        if ("error" in parsed) {
          console.error(`[city2graph] ${payload.type} error:`, parsed.error);
          reject(new Error(`city2graph ${payload.type} error: ${parsed.error}`));
          return;
        }
        resolve(parsed as T);
      } catch (e) {
        console.error("[city2graph] failed to parse output:", e);
        reject(new Error(`city2graph output parse failed: ${e instanceof Error ? e.message : String(e)}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function analyzeProximity(
  latitude: number,
  longitude: number,
  radiusM: number,
): Promise<ProximityResult | null> {
  return runCity2Graph<ProximityResult>({
    type: "proximity",
    latitude,
    longitude,
    radius_m: radiusM,
  });
}

export async function analyzeMorphology(
  latitude: number,
  longitude: number,
  radiusM: number,
): Promise<MorphologyResult | null> {
  return runCity2Graph<MorphologyResult>({
    type: "morphology",
    latitude,
    longitude,
    radius_m: radiusM,
  });
}

export async function analyzeIsochrone(
  latitude: number,
  longitude: number,
  thresholds?: readonly number[],
): Promise<IsochroneResult | null> {
  return runCity2Graph<IsochroneResult>({
    type: "isochrone",
    latitude,
    longitude,
    thresholds: thresholds ?? CONFIG.city2graph.isochroneThresholds,
  });
}
