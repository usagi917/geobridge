/**
 * Phase 1 スパイクテスト v3: 修正後の最終確認
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const TOKYO_STATION = { lat: 35.681236, lon: 139.767125 };

function createBbox(lat: number, lon: number, radiusM: number = 400): [number, number, number, number] {
  const latDelta = radiusM / 111320;
  const lonDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta];
}

function extractText(content: unknown): string | null {
  const arr = content as Array<{ type: string; text?: string }>;
  return arr.find(c => c.type === "text")?.text ?? null;
}

async function testJaxa() {
  console.log("\n=== JAXA MCP テスト (東京駅) ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/jaxa", "python", "mcp_server.py"],
  });
  const client = new Client({ name: "spike-test", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    const bbox = createBbox(TOKYO_STATION.lat, TOKYO_STATION.lon, 400);

    // AW3D 標高
    console.log("  [AW3D 標高]...");
    const t0 = Date.now();
    const r = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.EORC_ALOS.PRISM_AW3D30.v3.2_global",
        band: "DSM",
        dlim: ["2021-01-01T00:00:00", "2021-01-01T00:00:00"],
        bbox,
      },
    });
    console.log(`  ${r.isError ? "✗" : "✓"} (${Date.now() - t0}ms)`, extractText(r.content)?.substring(0, 200));

    // NDVI
    console.log("  [NDVI]...");
    const t1 = Date.now();
    const r1 = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-NDVI.daytime.v3_global_monthly",
        band: "NDVI",
        dlim: ["2024-10-01T00:00:00", "2024-12-31T00:00:00"],
        bbox,
      },
    });
    console.log(`  ${r1.isError ? "✗" : "✓"} (${Date.now() - t1}ms)`, extractText(r1.content)?.substring(0, 200));

    // LST
    console.log("  [LST]...");
    const t2 = Date.now();
    const r2 = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-LST.daytime.v3_global_monthly",
        band: "LST",
        dlim: ["2024-10-01T00:00:00", "2024-12-31T00:00:00"],
        bbox,
      },
    });
    console.log(`  ${r2.isError ? "✗" : "✓"} (${Date.now() - t2}ms)`, extractText(r2.content)?.substring(0, 200));

    // GSMaP
    console.log("  [GSMaP]...");
    const t3 = Date.now();
    const r3 = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.EORC_GSMaP_standard.Gauge.00Z-23Z.v6_monthly",
        band: "PRECIP",
        dlim: ["2024-10-01T00:00:00", "2024-12-31T00:00:00"],
        bbox,
      },
    });
    console.log(`  ${r3.isError ? "✗" : "✓"} (${Date.now() - t3}ms)`, extractText(r3.content)?.substring(0, 200));

    await transport.close();
  } catch (err) {
    console.error("✗ JAXA エラー:", err);
  }
}

async function testGeospatial() {
  console.log("\n=== MLIT Geospatial MCP テスト (東京駅) ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/geospatial", "python", "src/server.py"],
    env: {
      ...process.env,
      LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY || "",
    },
  });
  const client = new Client({ name: "spike-test", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);

    console.log("  [get_multi_api target_apis=[3,5,10]]...");
    const t0 = Date.now();
    const r = await client.callTool({
      name: "get_multi_api",
      arguments: {
        lat: TOKYO_STATION.lat,
        lon: TOKYO_STATION.lon,
        target_apis: [3, 5, 10],
        save_file: false,
      },
    });
    const text = extractText(r.content);
    console.log(`  完了 (${Date.now() - t0}ms)`);
    if (text) {
      const data = JSON.parse(text);
      console.log("  status:", data.status);
      if (data.data?.api_results) {
        data.data.api_results.forEach((r: unknown, i: number) => {
          if (r && typeof r === "object") {
            const obj = r as Record<string, unknown>;
            const features = (obj as { features?: unknown[] }).features;
            console.log(`  api_result[${i}]: ${features ? features.length + " features" : JSON.stringify(r).substring(0, 100)}`);
          } else {
            console.log(`  api_result[${i}]: ${r}`);
          }
        });
      }
    }

    console.log("\n  [get_land_price_point_by_location]...");
    const t1 = Date.now();
    const r1 = await client.callTool({
      name: "get_land_price_point_by_location",
      arguments: {
        lat: TOKYO_STATION.lat,
        lon: TOKYO_STATION.lon,
        save_file: false,
      },
    });
    console.log(`  完了 (${Date.now() - t1}ms)`);
    const text1 = extractText(r1.content);
    if (text1) console.log("  結果:", text1.substring(0, 300));

    await transport.close();
  } catch (err) {
    console.error("✗ Geospatial エラー:", err);
  }
}

async function main() {
  console.log("TerraScore Phase 1 スパイクテスト v3");
  await testJaxa();
  await testGeospatial();
  console.log("\n完了");
}

main().catch(console.error);
