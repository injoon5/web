#!/usr/bin/env bash
# Reproduce the Cursor Cloud Agent Ubuntu desktop environment on a clean install.
#
# Installs Ansible (if needed), syncs this bundle to /opt/cursor, runs the VNC
# desktop playbook, installs vendored cloud-agent-tools, wallpapers under
# /usr/share/backgrounds/, and optional ~/.cursor helpers.
#
# Usage (as root or via sudo):
#   ./config.sh
#   VNC_USER=ubuntu ANYOS_DESKTOP_APPEARANCE=light ./config.sh
#
# Requires: Ubuntu 22.04+ (or Debian with apt), network for apt/chrome/fonts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/config.env" ]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/config.env"
fi
VNC_USER="${VNC_USER:-ubuntu}"
ANYOS_DESKTOP_APPEARANCE="${ANYOS_DESKTOP_APPEARANCE:-light}"
CURSOR_HOME="${CURSOR_HOME:-/home/${VNC_USER}/.cursor}"
ASSET_INSTALL_MODE="${ASSET_INSTALL_MODE:-offline}"
OPT_CURSOR="/opt/cursor"
ANSIBLE_DEST="${OPT_CURSOR}/ansible"
CLOUD_TOOLS_DEST="${OPT_CURSOR}/cloud-agent-tools"
BUNDLE_SRC="${SCRIPT_DIR}/cloud-agent-tools/bundle"

log() { echo "[ubuntu-cursor-env] $*"; }
die() { echo "[ubuntu-cursor-env] ERROR: $*" >&2; exit 1; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "Run as root or with sudo: sudo ${SCRIPT_DIR}/config.sh"
  fi
}

install_apt_prerequisites() {
  log "Installing Ansible and build prerequisites..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq \
    ansible \
    python3 \
    python3-pip \
    rsync \
    ca-certificates \
    curl \
    gnupg \
    sudo \
    jq \
    unzip \
    zip \
    xz-utils \
    fontconfig
}

sync_ansible_tree() {
  log "Syncing Ansible playbook to ${ANSIBLE_DEST}..."
  mkdir -p "${OPT_CURSOR}"
  rsync -a --delete \
    "${SCRIPT_DIR}/ansible/" \
    "${ANSIBLE_DEST}/"
}

bundle_hash() {
  if [ -f "${BUNDLE_SRC}/.bundle-hash" ]; then
    tr -d '\n\r' < "${BUNDLE_SRC}/.bundle-hash"
    return
  fi
  (cd "${BUNDLE_SRC}" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)
}

install_cloud_agent_tools_bundle() {
  local hash dest
  hash="$(bundle_hash)"
  dest="${CLOUD_TOOLS_DEST}/${hash}"
  log "Installing cloud-agent-tools bundle (${hash:0:12}...)..."
  mkdir -p "${CLOUD_TOOLS_DEST}"
  rsync -a "${BUNDLE_SRC}/" "${dest}/"
  ln -sfn "${hash}" "${CLOUD_TOOLS_DEST}/current"
  printf '%s\n' "${hash}" > "${CLOUD_TOOLS_DEST}/current.bundle-hash"
  chmod 755 "${dest}"
  chmod -R a+rX "${dest}"
}

install_bundle_tools_from_manifest() {
  # Same behavior as cloud-agent-setup install_bundle_tools (offline, from TSV).
  local manifest="${CLOUD_TOOLS_DEST}/current/cloud-agent-tools.tsv"
  [ -f "${manifest}" ] || die "missing ${manifest}"

  log "Installing bundled tools from cloud-agent-tools.tsv..."
  local line tab asset_mode asset_remainder asset_hash bundle_path_b64 asset_destination_b64
  tab=$'\t'
  while IFS= read -r line || [ -n "${line}" ]; do
    [ -z "${line}" ] && continue
    asset_mode="${line%%${tab}*}"
    asset_remainder="${line#*${tab}}"
    asset_hash="${asset_remainder%%${tab}*}"
    asset_remainder="${asset_remainder#*${tab}}"
    bundle_path_b64="${asset_remainder%%${tab}*}"
    asset_destination_b64="${asset_remainder#*${tab}}"
    local bundle_path asset_destination source_path
    bundle_path="$(printf '%s' "${bundle_path_b64}" | base64 --decode)"
    asset_destination="$(printf '%s' "${asset_destination_b64}" | base64 --decode)"
    source_path="${CLOUD_TOOLS_DEST}/current/${bundle_path}"
    [ -f "${source_path}" ] || die "bundled file missing: ${source_path}"
    install -D -m "${asset_mode}" "${source_path}" "${asset_destination}"
    mkdir -p "$(dirname "${asset_destination}.hash")"
    printf '%s' "${asset_hash}" > "${asset_destination}.hash"
  done < "${manifest}"
}

install_cloud_agent_assets_offline() {
  log "Installing vendored cloud-agent assets (fonts, media, logos, wallpapers)..."
  chmod +x "${SCRIPT_DIR}/scripts/install-cloud-agent-assets-offline.sh"
  "${SCRIPT_DIR}/scripts/install-cloud-agent-assets-offline.sh"
}

install_cloud_agent_assets_online() {
  log "Downloading cloud-agent assets from ${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL}..."
  chmod +x "${SCRIPT_DIR}/scripts/install-cloud-agent-assets-online.sh"
  CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL="${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL}" \
  CLOUD_AGENT_ASSET_PREREQUISITES_VERSION="${CLOUD_AGENT_ASSET_PREREQUISITES_VERSION}" \
  OPT_CURSOR="${OPT_CURSOR}" \
    "${SCRIPT_DIR}/scripts/install-cloud-agent-assets-online.sh"
}

install_cloud_agent_assets() {
  case "${ASSET_INSTALL_MODE}" in
    offline)
      install_cloud_agent_assets_offline
      ;;
    online)
      install_cloud_agent_assets_online
      ;;
    auto)
      if [ -d "${SCRIPT_DIR}/vendor/cloud-agent-assets" ]; then
        install_cloud_agent_assets_offline
      else
        install_cloud_agent_assets_online
      fi
      ;;
    *)
      die "Unknown ASSET_INSTALL_MODE=${ASSET_INSTALL_MODE} (use offline, online, or auto)"
      ;;
  esac
  chmod +x "${SCRIPT_DIR}/scripts/verify-cursor-logos.sh"
  "${SCRIPT_DIR}/scripts/verify-cursor-logos.sh"
}

install_opt_cursor_dirs() {
  chmod +x "${SCRIPT_DIR}/scripts/install-opt-cursor-dirs.sh"
  "${SCRIPT_DIR}/scripts/install-opt-cursor-dirs.sh"
}

run_ansible_playbook() {
  log "Running Ansible VNC desktop playbook..."
  export VNC_USER ANYOS_DESKTOP_APPEARANCE
  ansible-playbook "${ANSIBLE_DEST}/vnc-desktop.yml" \
    --connection=local \
    -i localhost, \
    -e "vnc_user=${VNC_USER}" \
    -e "anyos_desktop_appearance=${ANYOS_DESKTOP_APPEARANCE}"
}

capture_vnc_user_env() {
  if [ ! -x /tmp/capture-vnc-user-env ]; then
    log "Skipping capture-vnc-user-env (script not installed yet)"
    return 0
  fi
  log "Capturing VNC user environment for ${VNC_USER}..."
  local user_home
  user_home="$(getent passwd "${VNC_USER}" | cut -d: -f6)"
  [ -n "${user_home}" ] || die "user ${VNC_USER} not found"
  sudo -u "${VNC_USER}" env HOME="${user_home}" USER="${VNC_USER}" \
    /tmp/capture-vnc-user-env /tmp/vnc-desktop-user-env
}

install_cursor_home_helpers() {
  if [ ! -d "${SCRIPT_DIR}/home-dot-cursor" ]; then
    return 0
  fi
  log "Installing ~/.cursor helpers for ${VNC_USER}..."
  local user_home
  user_home="$(getent passwd "${VNC_USER}" | cut -d: -f6)"
  mkdir -p "${user_home}/.cursor/bin"
  rsync -a "${SCRIPT_DIR}/home-dot-cursor/" "${user_home}/.cursor/"
  chown -R "${VNC_USER}:${VNC_USER}" "${user_home}/.cursor"
}

ensure_vnc_user() {
  if id "${VNC_USER}" &>/dev/null; then
    return 0
  fi
  log "Creating user ${VNC_USER}..."
  useradd -m -s /bin/bash "${VNC_USER}"
  usermod -aG sudo "${VNC_USER}" 2>/dev/null || true
}

main() {
  require_root
  ensure_vnc_user
  install_apt_prerequisites
  sync_ansible_tree
  install_cloud_agent_tools_bundle
  install_bundle_tools_from_manifest
  install_cloud_agent_assets
  install_opt_cursor_dirs
  # configure-os-display reads /tmp/vnc-desktop-user-env when present
  capture_vnc_user_env
  run_ansible_playbook
  "${SCRIPT_DIR}/scripts/verify-cursor-logos.sh"
  install_cursor_home_helpers
  log "Done. Ansible tree: ${ANSIBLE_DEST}"
  log "Asset CDN: ${CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL:-<not set>} (see cloud-agent-assets.urls.json)"
  log "Cloud tools: ${CLOUD_TOOLS_DEST}/current"
  log "Cloud media: /usr/local/share/cloud-agent-media/"
  log "Wallpapers: /usr/share/backgrounds/macos-wallpaper.png (+ desktop-background-{1,2,3}.png)"
  log "Fonts: /usr/share/fonts/truetype/macos/ + cascadia (after playbook)"
  log "noVNC: /usr/local/novnc/ (after playbook)"
  log "AnyOS config: /usr/local/share/anyos.conf — re-apply per-user with: anyos-setup ~${VNC_USER}"
  log "Cursor logos: /usr/share/pixmaps/cursor-logo.svg + hicolor apps (XFCE panel uses cursor-logo / cursor-logo-dark)"
  log "See SYSTEM_PATHS.md and cloud-agent-assets.urls.json"
}

main "$@"
