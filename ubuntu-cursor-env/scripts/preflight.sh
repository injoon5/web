#!/usr/bin/env bash
# Preflight checks before config.sh (clean-install readiness).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=/dev/null
[ -f "${ENV_ROOT}/config.env" ] && source "${ENV_ROOT}/config.env"

fail=0
warn=0

ok() { echo "[ok] $*"; }
warn_msg() { echo "[warn] $*"; warn=$((warn + 1)); }
bad() { echo "[fail] $*"; fail=$((fail + 1)); }

if [ "$(id -u)" -ne 0 ]; then
  warn_msg "Not root — config.sh must run as root (sudo)"
fi

if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) ok "OS ${PRETTY_NAME:-unknown}" ;;
    *) warn_msg "Untested OS ${PRETTY_NAME:-unknown}; Ubuntu 22.04+ recommended" ;;
  esac
else
  warn_msg "Cannot detect OS"
fi

for f in \
  "${ENV_ROOT}/config.sh" \
  "${ENV_ROOT}/config.env" \
  "${ENV_ROOT}/ansible/vnc-desktop.yml" \
  "${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-setup" \
  "${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-assets.tsv" \
  "${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-tools.tsv"; do
  if [ -e "${f}" ]; then ok "present $(basename "${f}")"; else bad "missing ${f}"; fi
done

if [ -d "${ENV_ROOT}/vendor/cloud-agent-assets" ]; then
  missing=0
  tab=$'\t'
  while IFS= read -r line || [ -n "${line}" ]; do
    [ -z "${line}" ] && continue
    dest_b64="${line##*${tab}}"
    dest="$(printf '%s' "${dest_b64}" | base64 --decode)"
    [ -f "${ENV_ROOT}/vendor/cloud-agent-assets${dest}" ] || missing=$((missing + 1))
  done < "${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-assets.tsv"
  if [ "${missing}" -eq 0 ]; then
    ok "vendor/cloud-agent-assets complete (offline install ready)"
  else
    bad "vendor missing ${missing} files — run: ./scripts/download-vendor-assets.sh"
  fi
else
  bad "vendor/cloud-agent-assets missing — run: ./scripts/download-vendor-assets.sh"
fi

for logo in cursor-logo.svg cursor-logo-dark.svg; do
  [ -f "${ENV_ROOT}/ansible/files/logos/${logo}" ] && ok "logo ${logo}" || bad "missing ansible/files/logos/${logo}"
done

deb_arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "${deb_arch}" in
  arm64|armhf|aarch64)
    ok "architecture ${deb_arch} — install-google-chrome will use Chromium"
    ;;
  amd64) ok "architecture ${deb_arch} — Google Chrome deb supported" ;;
  *) warn_msg "architecture ${deb_arch} — browser install may use Chromium fallback" ;;
esac

if [ -n "${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL:-}" ]; then
  if command -v curl >/dev/null 2>&1; then
    code="$(curl -sI -m 10 -o /dev/null -w '%{http_code}' \
      "${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL%/}/4961e33371b2d4ab16aef6058906f3462b140664aa277897f3d65f0681c28119.svg" 2>/dev/null || echo 000)"
    if [ "${code}" = "200" ]; then
      ok "CDN reachable (${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL})"
    else
      warn_msg "CDN probe HTTP ${code} — offline mode still works if vendor/ is complete"
    fi
  fi
else
  warn_msg "CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL unset in config.env"
fi

echo "---"
if [ "${fail}" -gt 0 ]; then
  echo "Preflight failed (${fail} errors, ${warn} warnings)" >&2
  exit 1
fi
echo "Preflight passed (${warn} warnings)"
exit 0
