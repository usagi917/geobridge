/**
 * デバッグ用スパイクテスト: JAXA レスポンス詳細 + Geospatial save_file パラメータ
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TOKYO_TOWER = { lat: 35.6586, lon: 139.7454 };

function createBbox(lat: number, lon: number, radiusM: number = 400): [number, number, number, number] {
  const latDelta = radiusM / 111320;
  const lonDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta];
}

async function debugJaxa() {
  console.log("\n=== JAXA デバッグ ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/jaxa", "python", "mcp_server.py"],
  });
  const client = new Client({ name: "spike-test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const bbox = createBbox(TOKYO_TOWER.lat, TOKYO_TOWER.lon, 400);
  console.log("  bbox:", bbox);

  // AW3D — raw result
  const result = await client.callTool({
    name: "calc_spatial_stats",
    arguments: {
      collection: "JAXA.EORC_ALOS.PRISM_AW3D30.v3.2_global",
      band: "DSM",
      bbox,
    },
  });
  console.log("  isError:", result.isError);
  console.log("  content:", JSON.stringify(result.content, null, 2));

  await transport.close();
}

async function debugGeospatial() {
  console.log("\n=== Geospatial デバッグ (save_file=false) ===");
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "--directory", "./mcp-servers/geospatial", "python", "src/server.py"],
    env: {
      ...process.env,
      LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY || "",
    },
  });
  const client = new Client({ name: "spike-test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  // ツール詳細を確認
  const tools = await client.listTools();
  const multiApiTool = tools.tools.find(t => t.name === "get_multi_api");
  console.log("  get_multi_api inputSchema:", JSON.stringify(multiApiTool?.inputSchema, null, 2));

  // save_file=false を付けて呼び出し
  console.log("\n  [get_multi_api with save_file=false]");
  const result = await client.callTool({
    name: "get_multi_api",
    arguments: {
      lat: TOKYO_TOWER.lat,
      lon: TOKYO_TOWER.lon,
      target_apis: [3, 5, 10],
      save_file: false,
    },
  });
  const text = (result.content as Array<{ type: string; text?: string }>).find(c => c.type === "text")?.text;
  if (text) {
    console.log("  結果 (先頭1000文字):", text.substring(0, 1000));
  }

  // get_land_price_point_by_location も save_file=false
  console.log("\n  [get_land_price_point_by_location with save_file=false]");
  const lpResult = await client.callTool({
    name: "get_land_price_point_by_location",
    arguments: {
      lat: TOKYO_TOWER.lat,
      lon: TOKYO_TOWER.lon,
      save_file: false,
    },
  });
  const lpText = (lpResult.content as Array<{ type: string; text?: string }>).find(c => c.type === "text")?.text;
  if (lpText) {
    console.log("  結果 (先頭1000文字):", lpText.substring(0, 1000));
  }

  await transport.close();
}

async function main() {
  await debugJaxa();
  await debugGeospatial();
}

main().catch(console.error);
