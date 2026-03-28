# TerraScore

[![日本語](https://img.shields.io/badge/lang-日本語-green.svg)](README.md)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-required-F69220.svg)](https://pnpm.io/)
[![uv](https://img.shields.io/badge/uv-required-4B32C3.svg)](https://docs.astral.sh/uv/)
[![License](https://img.shields.io/badge/license-not%20specified-lightgrey.svg)](#license)

> A Next.js application that combines JAXA satellite data and MLIT datasets into map- and chart-backed livability reports for candidate locations.

TerraScore creates an analysis job from an address or latitude/longitude, runs external JAXA and MLIT MCP servers from Node.js in parallel, normalizes the returned data, and stores a Japanese report composed of `facts / gaps / risks`. It prefers Ollama and only falls back to OpenAI when needed.

If some external data sources fail, the UI still renders partial results together with error details and source status instead of showing a blank screen.

## What It Does

- Analyze a candidate location from an address or coordinates
- Generate reports with four perspectives: `comprehensive`, `child_rearing`, `disaster`, `livability`
- Run background analysis jobs with progress polling
- Persist reports in SQLite
- Show key metric cards, a location map, trend charts, JAXA raster overlays, six narrative sections, data acquisition errors, and sources on the report page
- Prefer Ollama and use OpenAI only when `OPENAI_API_KEY` is configured

## UI Flow

1. Enter an address or coordinates on the home page.
2. Choose a reporting perspective.
3. Create an analysis job through `/api/geocode` and `/api/analyze`.
4. Poll `/api/analyze/[id]` from the frontend and show progress.
5. Redirect to `/report/[id]` and render the stored report.

## Tech Stack

| Layer | Implementation |
| --- | --- |
| Web | Next.js 15 App Router + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Maps | React Leaflet + Leaflet + OpenStreetMap |
| Storage | SQLite (`terrascore.db`) |
| MCP Client | `@modelcontextprotocol/sdk` + STDIO transport |
| LLM | Ollama (default `qwen3.5:35b-a3b`) / OpenAI `gpt-5-nano` fallback |
| Python utilities | `uv` + matplotlib / numpy / Pillow |

## Repository Layout

```text
app/                 Next.js pages and API Route Handlers
components/          Form, progress, report, chart, and map components
lib/mcp/             JAXA / MLIT Geospatial / MLIT DPF clients and orchestrator
lib/normalizer/      Raw MCP response normalization
lib/llm/             Ollama / OpenAI calls and prompts
lib/report/          Zod schemas, citations, and report assembly
lib/visualize/       Python-based image generation for maps and charts
scripts/             MCP setup and spike scripts
tests/               Regression tests
plans/               Planning documents and open tasks
```

`mcp-servers/` is not committed and is populated by the setup script.

## Prerequisites

- Node.js and `pnpm`
- Python 3.11+ and `uv`
- `git`
- A local Ollama instance
- MLIT API keys
- `MLIT_GEOSPATIAL_API_KEY`
- `MLIT_DPF_API_KEY`
- `OPENAI_API_KEY` only if you want the OpenAI fallback

## Setup

```bash
pnpm install
cp .env.example .env.local
./scripts/setup-mcp-servers.sh
pnpm dev
```

At minimum, configure the following in `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MLIT_GEOSPATIAL_API_KEY` | Yes | MLIT Geospatial MCP |
| `MLIT_GEOSPATIAL_SKIP_SSL_VERIFY` | No | Set to `true` only if you explicitly need to disable TLS verification |
| `MLIT_DPF_API_KEY` | Yes | MLIT DPF MCP |
| `OLLAMA_BASE_URL` | No | Ollama endpoint, default `http://localhost:11434` |
| `OLLAMA_MODEL` | No | Default `qwen3.5:35b-a3b` |
| `OPENAI_BASE_URL` | No | Default `https://api.openai.com/v1`. Use a regional endpoint such as `https://jp.api.openai.com/v1` if needed |
| `OPENAI_MODEL` | No | Default `gpt-5-nano` |
| `OPENAI_REASONING_EFFORT` | No | Default `low`. One of `none`, `minimal`, `low`, `medium`, `high`, `xhigh` |
| `OPENAI_VERBOSITY` | No | Default `low`. One of `low`, `medium`, `high` |
| `OPENAI_TIMEOUT_MS` | No | Timeout for the OpenAI fallback in milliseconds. Default `60000` |
| `OPENAI_MAX_TOKENS` | No | `max_output_tokens` for the OpenAI fallback. Default `1536` |
| `OPENAI_API_KEY` | No | Fallback when Ollama fails |

Notes:

- `./scripts/setup-mcp-servers.sh` prepares three servers under `mcp-servers/`: JAXA, MLIT Geospatial, and MLIT DPF.
- Report generation also invokes `lib/visualize/generate.py` through `uv run --directory ./lib/visualize`.
- The first successful analysis creates `terrascore.db` in the repository root.
- The OpenAI fallback uses the `Responses API` with `store: false` and structured JSON output.
- For production, prefer pinning `OPENAI_MODEL` to a snapshot instead of relying on an alias.

## Development Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm type-check
```

Current verified status in this repository:

- `pnpm build` succeeds
- `pnpm test` succeeds
- `pnpm lint` succeeds
- `pnpm type-check` succeeds after `.next/types` has been generated

Because `tsconfig.json` includes `.next/types/**/*.ts`, it is safest to run `pnpm build` once before `pnpm type-check` in a clean checkout.

## Quick Start

Using the UI:

1. Start the dev server with `pnpm dev`.
2. Open `http://localhost:3000` in your browser.
3. Enter an address or latitude/longitude.
4. Pick a perspective.
5. Watch progress and inspect the finished report page.

Calling the HTTP API directly:

```bash
curl -s http://localhost:3000/api/geocode \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"address":"東京都世田谷区三軒茶屋2丁目"}'
```

```bash
curl -s http://localhost:3000/api/analyze \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "address":"Tokyo Tower area",
    "latitude":35.6586,
    "longitude":139.7454,
    "perspective":"comprehensive"
  }'
```

```bash
curl -s http://localhost:3000/api/analyze/YOUR_JOB_ID
curl -s http://localhost:3000/api/report/YOUR_REPORT_ID
```

## What the Report Includes

- Header: address, coordinates, perspective, radius, generation time
- Key metrics: elevation, monthly precipitation for the captured month, land surface temperature, NDVI, land price
- A location map
- Trend analysis: annual precipitation, monthly precipitation, land surface temperature, NDVI, land price history
- Satellite overlay maps: NDVI, land surface temperature, precipitation
- Narrative sections: summary, disaster & safety, livability, environment, regional context, data gaps & cautions
- Error list
- Sources

## Implementation Notes

- All MCP calls are managed in Node.js. The LLM never executes tools directly.
- External responses are normalized in `lib/normalizer/` before being sent to the LLM.
- The LLM is asked to return JSON. If that fails, the app switches to a data-driven fallback summary.
- Citations and source errors are tracked and stored outside the LLM.
- Saved reports are sanitized and recovered so raw JSON is not exposed directly in the UI.

## Constraints and Known Gaps

- The current input schema caps the analysis radius at 400 meters.
- JAXA monthly layers are intentionally lagged to avoid incomplete recent months.
- Land price history is currently capped at the latest supported survey year, 2025.
- If MLIT keys are invalid or external MCP servers fail, the affected sections degrade to partial or missing results.
- Automated coverage is currently focused on unit/regression tests. E2E and broader location coverage remain open in `plans/task.md`.
- `scripts/` contains spike and troubleshooting utilities, not a hardened end-user CLI.

## Roadmap

Representative open items in `plans/task.md`:

- More validation across urban, suburban, and rural locations
- Partial-render testing during API timeouts
- Perspective-specific report quality review
- Performance verification against the 30-second target
- Broader QA coverage including E2E

## License

There is currently no `LICENSE` file in this repository. Until a license is added, treat the licensing terms as unspecified.
