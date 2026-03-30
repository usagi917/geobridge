import assert from "node:assert/strict";
import test from "node:test";
import * as geospatial from "../lib/mcp/geospatial-client";
import { McpClientManager } from "../lib/mcp/client-manager";
import type { McpToolResult } from "../lib/mcp/types";

function buildSuccessResult(apiResults: unknown[]): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          status: "success",
          data: {
            api_results: apiResults,
          },
        }),
      },
    ],
  };
}

test("getMultiApi passes the configured timeout into the MCP SDK call", { concurrency: false }, async (t) => {
  const originalCallTool = McpClientManager.prototype.callTool;
  const calls: Array<{ name: string; args: Record<string, unknown>; options?: { timeout?: number } }> = [];

  t.after(() => {
    McpClientManager.prototype.callTool = originalCallTool;
  });

  McpClientManager.prototype.callTool = async function mockCallTool(
    name: string,
    args: Record<string, unknown>,
    options?: { timeout?: number }
  ): Promise<McpToolResult> {
    calls.push({ name, args, options });
    return buildSuccessResult([
      {
        data: {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: { code: "4" } }],
        },
      },
      {
        data: {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: { code: "5" } }],
        },
      },
    ]);
  };

  const result = await geospatial.getMultiApi(35.0, 139.0, [4, 5], 400, { timeout: 12_345 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.name, "get_multi_api");
  assert.deepEqual(calls[0]?.options, { timeout: 12_345 });
  assert.deepEqual(calls[0]?.args.target_apis, [4, 5]);
  assert.equal((result.data?.["4"] as { type?: string })?.type, "FeatureCollection");
  assert.equal((result.data?.["5"] as { type?: string })?.type, "FeatureCollection");
});

test("getLandPriceHistory uses the dedicated land price tool for each year", { concurrency: false }, async (t) => {
  const originalCallTool = McpClientManager.prototype.callTool;
  const calls: Array<{ name: string; args: Record<string, unknown>; options?: { timeout?: number } }> = [];

  t.after(() => {
    McpClientManager.prototype.callTool = originalCallTool;
  });

  McpClientManager.prototype.callTool = async function mockCallTool(
    name: string,
    args: Record<string, unknown>,
    options?: { timeout?: number }
  ): Promise<McpToolResult> {
    calls.push({ name, args, options });

    const year = Number(args.year);
    return buildSuccessResult([
      {
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                L01_008: `${100_000 + year}`,
                L01_019: `Address ${year}`,
              },
            },
          ],
        },
      },
    ]);
  };

  const result = await geospatial.getLandPriceHistory(35.0, 139.0, 2024, 2025, {
    distance: 200,
    timeout: 4_321,
  });

  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.name === "get_land_price_point_by_location"));
  assert.ok(calls.every((call) => call.options?.timeout === 4_321));
  assert.ok(calls.every((call) => call.args.distance === 200));
  assert.deepEqual(
    result.data?.map((point) => point.year),
    [2024, 2025]
  );
  assert.deepEqual(
    result.data?.map((point) => point.address),
    ["Address 2024", "Address 2025"]
  );
});

test("getLandPricePoint rewrites generic SDK timeout errors with the request label", { concurrency: false }, async (t) => {
  const originalCallTool = McpClientManager.prototype.callTool;

  t.after(() => {
    McpClientManager.prototype.callTool = originalCallTool;
  });

  McpClientManager.prototype.callTool = async function mockCallTool(): Promise<McpToolResult> {
    throw new Error("Request timed out");
  };

  await assert.rejects(
    geospatial.getLandPricePoint(35.0, 139.0, 2025, {
      timeout: 20_000,
      timeoutLabel: "MLIT land price history 2025",
    }),
    /Timeout: MLIT land price history 2025 \(20000ms\)/
  );
});
