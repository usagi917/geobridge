/**
 * Phase 1 スパイクテスト v2: 修正後の疎通確認
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const TOKYO_TOWER = { lat: 35.6586, lon: 139.7454 };

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
  console.log("\n=== JAXA MCP テスト ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/jaxa", "python", "mcp_server.py"],
  });
  const client = new Client({ name: "spike-test", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    console.log("✓ 接続成功");

    const bbox = createBbox(TOKYO_TOWER.lat, TOKYO_TOWER.lon, 400);

    // AW3D 標高 (with dlim)
    console.log("\n  [AW3D 標高]...");
    const t0 = Date.now();
    const elevResult = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.EORC_ALOS.PRISM_AW3D30.v3.2_global",
        band: "DSM",
        dlim: ["2021-01-01T00:00:00", "2021-01-01T00:00:00"],
        bbox,
      },
    });
    console.log(`  完了 (${Date.now() - t0}ms), isError: ${elevResult.isError}`);
    const elevText = extractText(elevResult.content);
    if (elevText) console.log("  結果:", elevText.substring(0, 300));

    // NDVI
    console.log("\n  [NDVI]...");
    const t1 = Date.now();
    const ndviResult = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.GCOM-C.SGLI.L3.NDVI.v3_global_monthly",
        band: "NDVI",
        dlim: ["2025-01-01T00:00:00", "2025-03-01T00:00:00"],
        bbox,
      },
    });
    console.log(`  完了 (${Date.now() - t1}ms), isError: ${ndviResult.isError}`);
    const ndviText = extractText(ndviResult.content);
    if (ndviText) console.log("  結果:", ndviText.substring(0, 300));

    // LST
    console.log("\n  [LST]...");
    const t2 = Date.now();
    const lstResult = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.GCOM-C.SGLI.L3.LST.v3_global_monthly",
        band: "LST_Day",
        dlim: ["2025-01-01T00:00:00", "2025-03-01T00:00:00"],
        bbox,
      },
    });
    console.log(`  完了 (${Date.now() - t2}ms), isError: ${lstResult.isError}`);
    const lstText = extractText(lstResult.content);
    if (lstText) console.log("  結果:", lstText.substring(0, 300));

    // GSMaP 降水
    console.log("\n  [GSMaP 降水]...");
    const t3 = Date.now();
    const precResult = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.EORC_GPM.GSMaP.v8_monthly",
        band: "precipitation",
        dlim: ["2025-01-01T00:00:00", "2025-03-01T00:00:00"],
        bbox,
      },
    });
    console.log(`  完了 (${Date.now() - t3}ms), isError: ${precResult.isError}`);
    const precText = extractText(precResult.content);
    if (precText) console.log("  結果:", precText.substring(0, 300));

    await transport.close();
    console.log("\n✓ JAXA 全テスト完了");
  } catch (err) {
    console.error("✗ JAXA エラー:", err);
    try { await transport.close(); } catch {}
  }
}

async function testGeospatial() {
  console.log("\n=== MLIT Geospatial MCP テスト ===");
  console.log("  API key set:", !!process.env.MLIT_GEOSPATIAL_API_KEY);

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
    console.log("✓ 接続成功");

    // get_multi_api
    console.log("\n  [get_multi_api]...");
    const t0 = Date.now();
    const result = await client.callTool({
      name: "get_multi_api",
      arguments: {
        lat: TOKYO_TOWER.lat,
        lon: TOKYO_TOWER.lon,
        target_apis: [3, 5],
        save_file: false,
      },
    });
    console.log(`  完了 (${Date.now() - t0}ms)`);
    const text = extractText(result.content);
    if (text) console.log("  結果 (先頭500文字):", text.substring(0, 500));

    // get_land_price_point_by_location
    console.log("\n  [get_land_price_point_by_location]...");
    const t1 = Date.now();
    const lpResult = await client.callTool({
      name: "get_land_price_point_by_location",
      arguments: {
        lat: TOKYO_TOWER.lat,
        lon: TOKYO_TOWER.lon,
        save_file: false,
      },
    });
    console.log(`  完了 (${Date.now() - t1}ms)`);
    const lpText = extractText(lpResult.content);
    if (lpText) console.log("  結果 (先頭500文字):", lpText.substring(0, 500));

    await transport.close();
    console.log("\n✓ Geospatial 全テスト完了");
  } catch (err) {
    console.error("✗ Geospatial エラー:", err);
    try { await transport.close(); } catch {}
  }
}

async function main() {
  console.log("========================================");
  console.log("TerraScore Phase 1 スパイクテスト v2");
  console.log("========================================");

  await testJaxa();
  await testGeospatial();

  console.log("\n========================================");
  console.log("完了");
  console.log("========================================");
}

main().catch(console.error);
