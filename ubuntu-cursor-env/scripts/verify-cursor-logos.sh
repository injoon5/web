#!/usr/bin/env bash
# Verify Cursor panel logos are installed and match cloud-agent-assets.tsv hashes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST="${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-assets.tsv"

fail=0
tab=$'\t'

check_file() {
  local path="$1"
  local expected="$2"
  if [ ! -f "${path}" ]; then
    echo "MISSING ${path}" >&2
    fail=1
    return
  fi
  local actual
  actual="$(sha256sum "${path}" | cut -d' ' -f1)"
  if [ "${actual}" != "${expected}" ]; then
    echo "HASH MISMATCH ${path} (expected ${expected}, got ${actual})" >&2
    fail=1
    return
  fi
  echo "OK ${path}"
}

while IFS= read -r line || [ -n "${line}" ]; do
  [ -z "${line}" ] && continue
  dest_b64="${line##*$tab}"
  hash="${line#*$tab}"
  hash="${hash%%$tab*}"
  dest="$(printf '%s' "${dest_b64}" | base64 --decode)"
  case "${dest}" in
    *cursor-logo*) check_file "${dest}" "${hash}" ;;
  esac
done < "${MANIFEST}"

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

if [ "${fail}" -ne 0 ]; then
  echo "Cursor logo verification failed" >&2
  exit 1
fi

echo "Cursor logos verified (pixmaps + hicolor 24x24)"
