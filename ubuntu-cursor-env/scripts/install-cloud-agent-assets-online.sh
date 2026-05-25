#!/usr/bin/env bash
# Download cloud-agent assets from the CDN (same as cloud-agent-setup sync-assets).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=/dev/null
source "${ENV_ROOT}/config.env"

BASE="${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL:-}"
PREREQ_VERSION="${CLOUD_AGENT_ASSET_PREREQUISITES_VERSION:-}"

if [ -z "${BASE}" ]; then
  echo "ERROR: CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL is not set (see config.env)" >&2
  exit 1
fi
if [ -z "${PREREQ_VERSION}" ]; then
  echo "ERROR: CLOUD_AGENT_ASSET_PREREQUISITES_VERSION is not set (see config.env)" >&2
  exit 1
fi

SETUP="${OPT_CURSOR:-/opt/cursor}/cloud-agent-tools/current/cloud-agent-setup"
if [ ! -x "${SETUP}" ]; then
  SETUP="${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-setup"
fi
if [ ! -x "${SETUP}" ]; then
  echo "ERROR: cloud-agent-setup not found; run config.sh through bundle install first" >&2
  exit 1
fi

exec "${SETUP}" sync-assets "${BASE}" install-cloud-agent-assets "${PREREQ_VERSION}"
