#!/usr/bin/env bash
# Download every cloud-agent-assets.tsv entry from the CDN into vendor/.
# Run from repo on any machine with curl (maintainer / CI); not required on target VM if vendor/ is committed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=/dev/null
source "${ENV_ROOT}/config.env"

BASE="${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL%/}"
TSV="${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-assets.tsv"
VENDOR_ROOT="${ENV_ROOT}/vendor/cloud-agent-assets"
MANIFEST_OUT="${ENV_ROOT}/vendor/MANIFEST.sha256"

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl required" >&2
  exit 1
fi

mkdir -p "${VENDOR_ROOT}"
tab=$'\t'
ok=0
fail=0

while IFS= read -r line || [ -n "${line}" ]; do
  [ -z "${line}" ] && continue
  asset_hash="${line#*${tab}}"
  asset_hash="${asset_hash%%${tab}*}"
  asset_remainder="${line#*${tab}}"
  asset_remainder="${asset_remainder#*${tab}}"
  asset_suffix="${asset_remainder%%${tab}*}"
  asset_destination_b64="${asset_remainder#*${tab}}"
  asset_destination="$(printf '%s' "${asset_destination_b64}" | base64 --decode)"
  dest_path="${VENDOR_ROOT}${asset_destination}"
  url="${BASE}/${asset_hash}${asset_suffix}"
  tmp="$(mktemp)"

  echo "GET ${url}"
  if ! curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors -o "${tmp}" "${url}"; then
    echo "FAIL download ${url}" >&2
    rm -f "${tmp}"
    fail=$((fail + 1))
    continue
  fi

  actual="$(sha256sum "${tmp}" | cut -d' ' -f1)"
  if [ "${actual}" != "${asset_hash}" ]; then
    echo "FAIL hash ${asset_destination} expected ${asset_hash} got ${actual}" >&2
    rm -f "${tmp}"
    fail=$((fail + 1))
    continue
  fi

  install -D -m 0644 "${tmp}" "${dest_path}"
  rm -f "${tmp}"
  ok=$((ok + 1))
  echo "OK ${asset_destination}"
done < "${TSV}"

(
  cd "${VENDOR_ROOT}" && find . -type f ! -name 'MANIFEST.sha256' -print0 | sort -z | xargs -0 sha256sum
) > "${MANIFEST_OUT}" 2>/dev/null || true

echo "Downloaded ${ok} assets to ${VENDOR_ROOT} (${fail} failures)"
if [ "${fail}" -ne 0 ]; then
  echo "ERROR: CDN base may be wrong or unreachable: ${BASE}" >&2
  exit 1
fi

"${SCRIPT_DIR}/generate-asset-urls.sh"
echo "Vendor refresh complete."
