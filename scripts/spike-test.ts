/**
 * Phase 1 スパイクテスト: MCP サーバー疎通確認
 * 東京タワー座標 (35.6586, 139.7454) で各 MCP サーバーを呼び出す
 *
 * 実行: npx tsx scripts/spike-test.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TOKYO_TOWER = { lat: 35.6586, lon: 139.7454 };

function createBbox(lat: number, lon: number, radiusM: number = 400): [number, number, number, number] {
  const latDelta = radiusM / 111320;
  const lonDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta];
}

async function testJaxa() {
  console.log("\n=== JAXA MCP スパイクテスト ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/jaxa", "python", "mcp_server.py"],
  });
  const client = new Client({ name: "spike-test", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    console.log("✓ JAXA MCP 接続成功");

    // ツール一覧
    const tools = await client.listTools();
    console.log("  利用可能ツール:", tools.tools.map(t => t.name).join(", "));

    // AW3D 標高テスト
    console.log("\n  [AW3D 標高] calc_spatial_stats 呼び出し中...");
    const bbox = createBbox(TOKYO_TOWER.lat, TOKYO_TOWER.lon, 400);
    const start = Date.now();
    const elevResult = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.EORC_ALOS.PRISM_AW3D30.v3.2_global",
        band: "DSM",
        bbox,
      },
    });
    const elapsed = Date.now() - start;
    console.log(`  ✓ AW3D 完了 (${elapsed}ms)`);
    const elevText = (elevResult.content as Array<{ type: string; text?: string }>).find(c => c.type === "text")?.text;
    if (elevText) {
      const data = JSON.parse(elevText);
      console.log("  結果:", JSON.stringify(data, null, 2).substring(0, 500));
    }

    // NDVI テスト
    console.log("\n  [NDVI] calc_spatial_stats 呼び出し中...");
    const ndviStart = Date.now();
    const ndviResult = await client.callTool({
      name: "calc_spatial_stats",
      arguments: {
        collection: "JAXA.GCOM-C.SGLI.L3.NDVI.v3_global_monthly",
        band: "NDVI",
        dlim: ["2025-01-01T00:00:00", "2025-03-01T00:00:00"],
        bbox,
      },
    });
    const ndviElapsed = Date.now() - ndviStart;
    console.log(`  ✓ NDVI 完了 (${ndviElapsed}ms)`);
    const ndviText = (ndviResult.content as Array<{ type: string; text?: string }>).find(c => c.type === "text")?.text;
    if (ndviText) {
      const data = JSON.parse(ndviText);
      console.log("  結果:", JSON.stringify(data, null, 2).substring(0, 500));
    }

    await transport.close();
    console.log("\n✓ JAXA MCP テスト完了");
  } catch (err) {
    console.error("✗ JAXA MCP エラー:", err);
    try { await transport.close(); } catch {}
  }
}

async function testGeospatial() {
  console.log("\n=== MLIT Geospatial MCP スパイクテスト ===");
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
    console.log("✓ Geospatial MCP 接続成功");

    const tools = await client.listTools();
    console.log("  利用可能ツール:", tools.tools.map(t => t.name).join(", "));

    // get_multi_api テスト
    console.log("\n  [get_multi_api] 呼び出し中...");
    const start = Date.now();
    const multiResult = await client.callTool({
      name: "get_multi_api",
      arguments: {
        lat: TOKYO_TOWER.lat,
        lon: TOKYO_TOWER.lon,
        target_apis: [3, 5, 10],
      },
    });
    const elapsed = Date.now() - start;
    console.log(`  ✓ get_multi_api 完了 (${elapsed}ms)`);
    const multiText = (multiResult.content as Array<{ type: string; text?: string }>).find(c => c.type === "text")?.text;
    if (multiText) {
      console.log("  結果 (先頭500文字):", multiText.substring(0, 500));
    }

    // get_land_price_point_by_location テスト
    console.log("\n  [get_land_price_point_by_location] 呼び出し中...");
    const lpStart = Date.now();
    const lpResult = await client.callTool({
      name: "get_land_price_point_by_location",
      arguments: {
        lat: TOKYO_TOWER.lat,
        lon: TOKYO_TOWER.lon,
      },
    });
    const lpElapsed = Date.now() - lpStart;
    console.log(`  ✓ get_land_price_point_by_location 完了 (${lpElapsed}ms)`);
    const lpText = (lpResult.content as Array<{ type: string; text?: string }>).find(c => c.type === "text")?.text;
    if (lpText) {
      console.log("  結果 (先頭500文字):", lpText.substring(0, 500));
    }

    await transport.close();
    console.log("\n✓ Geospatial MCP テスト完了");
  } catch (err) {
    console.error("✗ Geospatial MCP エラー:", err);
    try { await transport.close(); } catch {}
  }
}

async function testDpf() {
  console.log("\n=== MLIT DPF MCP スパイクテスト ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/dpf", "python", "src/server.py"],
    env: {
      ...process.env,
      MLIT_API_KEY: process.env.MLIT_DPF_API_KEY || "",
    },
  });
  const client = new Client({ name: "spike-test", version: "1.0.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    console.log("✓ DPF MCP 接続成功");

    const tools = await client.listTools();
    console.log("  利用可能ツール:", tools.tools.map(t => t.name).join(", "));

    await transport.close();
    console.log("\n✓ DPF MCP テスト完了");
  } catch (err) {
    console.error("✗ DPF MCP エラー:", err);
    try { await transport.close(); } catch {}
  }
}

async function main() {
  console.log("========================================");
  console.log("TerraScore Phase 1 スパイクテスト");
  console.log(`テスト座標: 東京タワー (${TOKYO_TOWER.lat}, ${TOKYO_TOWER.lon})`);
  console.log("========================================");

  await testJaxa();
  await testGeospatial();
  await testDpf();

  console.log("\n========================================");
  console.log("全テスト完了");
  console.log("========================================");
}

main().catch(console.error);
