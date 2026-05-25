# System paths used by Cursor Cloud Agent desktop setup

Inventory from the live cloud VM and `vnc-desktop.yml` / `cloud-agent-setup`.  
`config.sh` targets these paths; items marked **runtime** are not fully vendored.

## `/opt/cursor`

| Path | Purpose | Installed by |
|------|---------|--------------|
| `/opt/cursor/ansible/` | Playbook + `files/` | `config.sh` rsync |
| `/opt/cursor/cloud-agent-tools/<hash>/` | VNC/AnyOS script bundle | `config.sh` |
| `/opt/cursor/cloud-agent-tools/current` | Symlink to active bundle | `config.sh` |
| `/opt/cursor/artifacts/` | Agent artifact output (777) | playbook + `install-opt-cursor-dirs.sh` |
| `/opt/cursor/recording-staging/` | Screen recording staging (777) | playbook + `install-opt-cursor-dirs.sh` |
| `/opt/cursor/logs/` | Agent logs (777) | `install-opt-cursor-dirs.sh` |
| `/opt/cursor/.exec-daemon/` | **Runtime** exec-daemon mount point | marker only in bundle |

## `/exec-daemon` (**runtime**, not in repo)

| Path | Purpose |
|------|---------|
| `/exec-daemon/gh` | GitHub CLI (symlinked from `/usr/local/bin/gh`) |
| `/exec-daemon/node` | Node runtime for agent |
| `/exec-daemon/cursorsandbox` | Sandbox helper |
| `/exec-daemon/exec-daemon` | Controller entry |

## `/usr/local/bin` (versioned install scripts)

Installed from `cloud-agent-tools.tsv`, then invoked by Ansible:

- `anyos-setup`, `configure-os-display`, `configure-google-chrome`
- `install-vnc-desktop-apt-packages`, `install-google-chrome`, `install-locales`
- `install-fonts-and-fontconfig`, `install-and-configure-themes`
- `install-remote-vnc-setup`, `install-cursor-artifact-directories`
- `google-chrome`, `chrome` (wrappers)
- `websockify` (after noVNC install)

**Not from VNC playbook** (base image / runtime): `nvm-init.sh`, `gh` → `/exec-daemon/gh`, Python helpers.

## `/usr/local/share`

| Path | Purpose |
|------|---------|
| `/usr/local/share/anyos.conf` | Display/DPI/font variables |
| `/usr/local/share/desktop-init.sh` | VNC desktop entrypoint |
| `/usr/local/share/vnc-desktop.Aptfile` | Apt package list |
| `/usr/local/share/cloud-agent-media/` | Theme/font/VNC archives (vendored in `vendor/`) |
| `/usr/local/share/install-cloud-agent-assets-*.version` | Prerequisite version stamps |

## `/usr/share/backgrounds`

| File | Source in bundle |
|------|------------------|
| `macos-wallpaper.png` | `ansible/files/backgrounds/desktop_background_0.png` |
| `desktop-background-1.png` | `desktop_background_1.png` |
| `desktop-background-2.png` | `desktop_background_2.png` |
| `desktop-background-3.png` | `desktop_background_3.png` |
| `xfce/` | Stock Xfce backgrounds (from `xfce4` apt package) |

## Fonts

| Path | Purpose |
|------|---------|
| `/usr/share/fonts/truetype/macos/` | Inter, Public Sans, JetBrains Mono, Source Sans 3 |
| `/usr/share/fonts/truetype/cascadia/` | Extracted from `CascadiaCode-2008.25.zip` |
| `/etc/fonts/local.conf` | Web font substitutions | `install-fonts-and-fontconfig.sh` |

## Themes / icons / cursors (after playbook)

| Path | Source archive |
|------|----------------|
| `/usr/share/themes/WhiteSur-Light/` | `WhiteSur-Light.tar.xz` |
| `/usr/share/icons/WhiteSur/` | `WhiteSur-icon-theme-master.tar.gz` |
| `/usr/share/icons/WhiteSur-cursors/` | `WhiteSur-cursors-master.tar.gz` |
| `/usr/share/plank/themes/WhiteSur-Light/` | From GTK theme |

## VNC / noVNC

| Path | Purpose |
|------|---------|
| `/usr/local/novnc/noVNC-1.2.0/` | noVNC web client |
| `/usr/local/novnc/websockify-0.10.0/` | Websockify |
| `/tmp/capture-vnc-user-env` | User/home capture script |
| `/tmp/vnc-desktop-user-env` | Captured `USER` + `HOME` lines |
| `/tmp/vnc-desktop-apt-cleanup-needed` | Apt cleanup marker |
| `/etc/tigervnc/` | TigerVNC config |
| `~/.vnc/` | Per-user VNC session files |

## Branding (Cursor logos)

| Path | In bundle | CDN URL in `cloud-agent-assets.urls.json` |
|------|-----------|-------------------------------------------|
| `/usr/share/pixmaps/cursor-logo.svg` | yes | `.../4961e333....svg` |
| `/usr/share/pixmaps/cursor-logo-dark.svg` | yes | `.../0a964657....svg` |
| `/usr/share/icons/hicolor/24x24/apps/cursor-logo.png` | yes | `.../a6ca61d1....png` |
| `/usr/share/icons/hicolor/24x24/apps/cursor-logo-dark.png` | yes | `.../e0e7a7bc....png` |

XFCE `applicationsmenu` plugin uses icon name `cursor-logo` (light panel) or `cursor-logo-dark` (dark panel).

**Download base URL** (`config.env`):

`https://public-asphr-vm-daemon-bucket.s3.us-east-1.amazonaws.com/cloud-agent-assets`

Pattern: `{base}/{sha256}{suffix}` — same as `cloud-agent-setup sync-assets`.

## User home (`~/.cursor`)

| Path | In `home-dot-cursor/` |
|------|------------------------|
| `~/.cursor/bin/cursor-git-ssh-keygen` | yes |
| `~/.cursor/agent-hooks/<workspace-hash>/` | yes (commit-msg, pre-commit) |
| `~/.cursor/plugins/` | **no** (large cache; IDE sync) |

## Vendored offline tree

`vendor/cloud-agent-assets/` mirrors destination paths for `cloud-agent-assets.tsv` (31 files, ~41MB including media archives).
