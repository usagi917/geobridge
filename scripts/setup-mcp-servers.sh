#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MCP_DIR="$PROJECT_DIR/mcp-servers"

echo "=== TerraScore MCP サーバーセットアップ ==="

# 1. JAXA Earth MCP (Python)
echo ""
echo "--- JAXA Earth MCP ---"
JAXA_DIR="$MCP_DIR/jaxa"
if [ ! -d "$JAXA_DIR/.venv" ]; then
  echo "JAXA MCP サーバーをセットアップ中..."
  mkdir -p "$JAXA_DIR"
  cd "$JAXA_DIR"

  # Create pyproject.toml for JAXA
  cat > pyproject.toml << 'PYEOF'
[project]
name = "jaxa-earth-mcp"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
  "jaxa-earth",
  "mcp",
]

[[tool.uv.index]]
name = "jaxa"
url = "https://data.earth.jaxa.jp/api/python/repository/"
PYEOF

  # Create the MCP server entry point
  mkdir -p jaxa_earth_mcp
  cat > jaxa_earth_mcp/__init__.py << 'PYEOF'
"""JAXA Earth MCP Server wrapper."""
PYEOF

  cat > jaxa_earth_mcp/__main__.py << 'PYEOF'
"""Run the JAXA Earth MCP server."""
from jaxa.earth.mcp import mcp_server
mcp_server.main()
PYEOF

  uv sync 2>&1 || echo "Warning: JAXA MCP setup may need manual intervention"
  cd "$PROJECT_DIR"
else
  echo "JAXA MCP: already set up"
fi

# 2. MLIT Geospatial MCP (Python)
echo ""
echo "--- MLIT Geospatial MCP ---"
GEO_DIR="$MCP_DIR/geospatial"
if [ ! -d "$GEO_DIR/.git" ]; then
  echo "MLIT Geospatial MCP サーバーをクローン中..."
  git clone https://github.com/chirikuuka/mlit-geospatial-mcp.git "$GEO_DIR" 2>&1 || echo "Warning: Clone may have failed"
  cd "$GEO_DIR"
  uv sync 2>&1 || echo "Warning: Geospatial MCP setup may need manual intervention"
  cd "$PROJECT_DIR"
else
  echo "MLIT Geospatial MCP: already cloned"
fi

# 3. MLIT DPF MCP (Python)
echo ""
echo "--- MLIT DPF MCP ---"
DPF_DIR="$MCP_DIR/dpf"
if [ ! -d "$DPF_DIR/.git" ]; then
  echo "MLIT DPF MCP サーバーをクローン中..."
  git clone https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp.git "$DPF_DIR" 2>&1 || echo "Warning: Clone may have failed"
  cd "$DPF_DIR"
  uv sync 2>&1 || echo "Warning: DPF MCP setup may need manual intervention"
  cd "$PROJECT_DIR"
else
  echo "MLIT DPF MCP: already cloned"
fi

echo ""
echo "=== セットアップ完了 ==="
echo "次のステップ:"
echo "1. .env.local に API キーを設定してください"
echo "2. pnpm dev で開発サーバーを起動してください"
