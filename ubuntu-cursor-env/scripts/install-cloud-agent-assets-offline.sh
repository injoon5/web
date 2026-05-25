#!/usr/bin/env bash
# Install cloud-agent-assets from ubuntu-cursor-env/vendor (offline).
# Mirrors cloud-agent-setup sync_cloud_agent_assets without CDN downloads.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENDOR_ROOT="${ENV_ROOT}/vendor/cloud-agent-assets"
MANIFEST="${ENV_ROOT}/cloud-agent-tools/bundle/cloud-agent-assets.tsv"
COMMAND_NAME="${1:-install-cloud-agent-assets-offline}"

hash_file() {
  sha256sum "$1" | cut -d' ' -f1
}

if [ ! -f "${MANIFEST}" ]; then
  echo "ERROR: missing manifest ${MANIFEST}" >&2
  exit 1
fi

if [ ! -d "${VENDOR_ROOT}" ]; then
  echo "ERROR: missing vendor tree ${VENDOR_ROOT}" >&2
  exit 1
fi

icons_changed=false
fonts_changed=false
tab=$'\t'

while IFS= read -r line || [ -n "${line}" ]; do
  [ -z "${line}" ] && continue

  asset_mode="${line%%${tab}*}"
  asset_remainder="${line#*${tab}}"
  asset_hash="${asset_remainder%%${tab}*}"
  asset_remainder="${asset_remainder#*${tab}}"
  # asset_suffix="${asset_remainder%%${tab}*}"
  asset_destination_b64="${asset_remainder#*${tab}}"
  asset_destination="$(printf '%s' "${asset_destination_b64}" | base64 --decode)"

  source_path="${VENDOR_ROOT}${asset_destination}"
  if [ ! -f "${source_path}" ]; then
    echo "ERROR: vendored asset missing at ${source_path}" >&2
    exit 1
  fi

  source_hash="$(hash_file "${source_path}")"
  if [ "${source_hash}" != "${asset_hash}" ]; then
    echo "ERROR: hash mismatch for ${source_path} (manifest ${asset_hash}, got ${source_hash})" >&2
    exit 1
  fi

  asset_hash_file="${asset_destination}.hash"
  asset_current_hash=""
  if [ -f "${asset_destination}" ] && [ -f "${asset_hash_file}" ]; then
    asset_current_hash="$(tr -d '\n\r' < "${asset_hash_file}")"
  fi

  if [ "${asset_current_hash}" = "${asset_hash}" ]; then
    echo "${COMMAND_NAME}: ${asset_destination} already at ${asset_hash}, skipping"
    continue
  fi

  install -D -m "${asset_mode}" "${source_path}" "${asset_destination}"
  mkdir -p "$(dirname "${asset_hash_file}")"
  printf '%s' "${asset_hash}" > "${asset_hash_file}"

  case "${asset_destination}" in
    /usr/share/icons/* | /usr/share/pixmaps/*) icons_changed=true ;;
    /usr/share/fonts/*) fonts_changed=true ;;
  esac

  echo "${COMMAND_NAME}: installed ${asset_destination} at ${asset_hash}"
done < "${MANIFEST}"

if [ "${icons_changed}" = true ] && command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f /usr/share/icons/hicolor || true
fi

if [ "${fonts_changed}" = true ] && command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f
fi

echo "${COMMAND_NAME}: finished"
