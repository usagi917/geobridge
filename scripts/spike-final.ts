/**
 * Phase 1 スパイク最終テスト: 全MCP疎通確認
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
  const minDelta = 0.005;
  return [
    lon - Math.max(lonDelta, minDelta),
    lat - Math.max(latDelta, minDelta),
    lon + Math.max(lonDelta, minDelta),
    lat + Math.max(latDelta, minDelta),
  ];
}

function extractText(content: unknown): string | null {
  const arr = content as Array<{ type: string; text?: string }>;
  return arr.find(c => c.type === "text")?.text ?? null;
}

async function testJaxa() {
  console.log("\n=== JAXA MCP ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/jaxa", "python", "mcp_server.py"],
  });
  const client = new Client({ name: "spike", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const bbox = createBbox(TOKYO_STATION.lat, TOKYO_STATION.lon, 400);
  console.log("  bbox:", bbox, "diff:", (bbox[2]-bbox[0]).toFixed(4), "x", (bbox[3]-bbox[1]).toFixed(4));

  const tests = [
    { label: "AW3D(標高)", args: { collection: "JAXA.EORC_ALOS.PRISM_AW3D30.v3.2_global", band: "DSM", dlim: ["2021-02-01T00:00:00", "2021-02-28T00:00:00"], bbox }},
    { label: "NDVI(植生)", args: { collection: "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-NDVI.daytime.v3_global_monthly", band: "NDVI", dlim: ["2024-10-01T00:00:00", "2024-12-31T00:00:00"], bbox }},
    { label: "LST(地表温度)", args: { collection: "JAXA.G-Portal_GCOM-C.SGLI_standard.L3-LST.daytime.v3_global_monthly", band: "LST", dlim: ["2024-10-01T00:00:00", "2024-12-31T00:00:00"], bbox }},
    { label: "GSMaP(降水)", args: { collection: "JAXA.EORC_GSMaP_standard.Gauge.00Z-23Z.v6_monthly", band: "PRECIP", dlim: ["2024-10-01T00:00:00", "2024-12-31T00:00:00"], bbox }},
  ];

  for (const test of tests) {
    const t0 = Date.now();
    const r = await client.callTool({ name: "calc_spatial_stats", arguments: test.args });
    const text = extractText(r.content);
    if (r.isError) {
      console.log(`  ✗ ${test.label} (${Date.now()-t0}ms): ${text?.substring(0, 100)}`);
    } else {
      console.log(`  ✓ ${test.label} (${Date.now()-t0}ms): ${text?.substring(0, 150)}`);
    }
  }
  await transport.close();
}

async function testGeospatial() {
  console.log("\n=== MLIT Geospatial MCP ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/geospatial", "python", "src/server.py"],
    env: { ...process.env, LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY || "" },
  });
  const client = new Client({ name: "spike", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const t0 = Date.now();
  const r = await client.callTool({
    name: "get_multi_api",
    arguments: { lat: TOKYO_STATION.lat, lon: TOKYO_STATION.lon, target_apis: [3, 5, 10, 11, 12], save_file: false },
  });
  const text = extractText(r.content);
  console.log(`  get_multi_api (${Date.now()-t0}ms):`);
  if (text) {
    const data = JSON.parse(text);
    console.log("    status:", data.status);
    const results = data.data?.api_results;
    if (results) {
      results.forEach((r: unknown, i: number) => {
        if (r && typeof r === "object" && "features" in (r as object)) {
          console.log(`    [${i}]: ${((r as {features: unknown[]}).features).length} features`);
        } else {
          console.log(`    [${i}]:`, r === null ? "null (データなし)" : JSON.stringify(r).substring(0, 80));
        }
      });
    }
  }

  await transport.close();
}

async function testDpf() {
  console.log("\n=== MLIT DPF MCP ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/dpf", "python", "src/server.py"],
    env: { ...process.env, MLIT_API_KEY: process.env.MLIT_DPF_API_KEY || "" },
  });
  const client = new Client({ name: "spike", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const t0 = Date.now();
  const r = await client.callTool({
    name: "search_by_location_point_distance",
    arguments: { lat: TOKYO_STATION.lat, lon: TOKYO_STATION.lon, distance: 1 },
  });
  const text = extractText(r.content);
  console.log(`  search_by_location (${Date.now()-t0}ms): ${r.isError ? "✗" : "✓"}`);
  if (text) console.log("  結果 (先頭200文字):", text.substring(0, 200));

  await transport.close();
}

async function main() {
  console.log("TerraScore Phase 1 最終スパイクテスト");
  console.log(`座標: 東京駅 (${TOKYO_STATION.lat}, ${TOKYO_STATION.lon})`);
  await testJaxa();
  await testGeospatial();
  await testDpf();
  console.log("\n完了");
}
main().catch(console.error);
