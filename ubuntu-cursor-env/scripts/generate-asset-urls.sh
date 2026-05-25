#!/usr/bin/env bash
# Regenerate cloud-agent-assets.urls.json from cloud-agent-assets.tsv + config.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TSV="${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-assets.tsv"
OUT="${ENV_ROOT}/cloud-agent-assets.urls.json"

# shellcheck source=/dev/null
source "${ENV_ROOT}/config.env"

BASE="${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL%/}"

python3 - "${TSV}" "${OUT}" "${BASE}" <<'PY'
import base64
import json
import sys

tsv_path, out_path, base = sys.argv[1:4]
assets = []
for line in open(tsv_path, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    mode, sha, suffix, dest_b64 = line.split("\t", 3)
    dest = base64.b64decode(dest_b64).decode()
    url = f"{base}/{sha}{suffix}"
    assets.append(
        {
            "mode": mode,
            "hash": sha,
            "suffix": suffix,
            "destination": dest,
            "downloadUrl": url,
        }
    )

payload = {
    "downloadBaseUrl": base,
    "urlPattern": "{downloadBaseUrl}/{hash}{suffix}",
    "assets": assets,
}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")
print(f"Wrote {len(assets)} asset URLs to {out_path}")
PY
