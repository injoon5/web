# Installation guide — Ubuntu Cursor Cloud Agent environment

This guide installs the same VNC desktop stack used on Cursor Cloud Agents onto a **clean Ubuntu 22.04 or 24.04 (amd64)** machine. The bundle is self-contained: fonts, themes, wallpapers, logos, and install scripts are vendored under `vendor/` so **offline asset install works without the CDN**.

## What you get

- TigerVNC + XFCE4 + noVNC (web VNC on port 26058)
- Google Chrome, Plank dock, WhiteSur macOS-like theme
- Cursor logos in the top panel (`cursor-logo` / `cursor-logo-dark`)
- Four wallpapers under `/usr/share/backgrounds/`
- `/opt/cursor` layout (ansible, cloud-agent-tools, artifacts)
- Optional `~/.cursor` git hooks + `bin/cursor-git-ssh-keygen`

## Requirements

| Requirement | Notes |
|-------------|--------|
| OS | Ubuntu 22.04+ or Debian 12+ (amd64) |
| RAM / disk | ~4 GB RAM; ~2 GB free disk for apt + themes |
| Root | `sudo` for `config.sh` |
| Network | **Required** for `apt` and **Google Chrome** download during Ansible |
| Network (assets) | **Not required** if `vendor/cloud-agent-assets/` is present (committed in repo) |

## Quick install (clean machine)

```bash
# 1. Clone the repo (or copy ubuntu-cursor-env/ onto the machine)
git clone <your-repo-url>
cd <repo>/ubuntu-cursor-env

# 2. Preflight (optional but recommended)
./scripts/preflight.sh          # as normal user
sudo ./scripts/preflight.sh     # as root — same checks

# 3. Install everything (~15–30 min depending on network)
chmod +x config.sh
sudo ./config.sh
```

Default settings come from `config.env` (`ASSET_INSTALL_MODE=offline`).

### Environment overrides

```bash
# Dark top panel (historical white foreground)
sudo ANYOS_DESKTOP_APPEARANCE=dark ./config.sh

# Different desktop user (created if missing)
sudo VNC_USER=myuser ./config.sh

# Force CDN download instead of vendor/ (needs network)
sudo ASSET_INSTALL_MODE=online ./config.sh
```

## Verify installation

```bash
# Logos (hash-checked)
sudo ./scripts/verify-cursor-logos.sh

# Key paths
ls -la /usr/share/pixmaps/cursor-logo*.svg
ls -la /usr/local/share/cloud-agent-media/
ls -la /opt/cursor/ansible/vnc-desktop.yml
ls -la /usr/local/novnc/noVNC-1.2.0/    # after playbook completes

# Start desktop (see COMPONENTS.md — desktop-init.sh)
sudo /usr/local/share/desktop-init.sh
```

noVNC: `http://<host>:26058` (if firewall allows). Raw VNC: port `5901` by default.

## Install flow (what `config.sh` does)

1. **preflight** — bundle complete, vendor present, optional CDN probe  
2. **apt** — ansible, python3, curl, jq, fontconfig, …  
3. **sync** `ansible/` → `/opt/cursor/ansible/`  
4. **cloud-agent-tools** bundle → `/opt/cursor/cloud-agent-tools/<hash>/` + `current` symlink  
5. **tools.tsv** — install scripts to `/usr/local/bin`, `anyos-setup`, capture-vnc-user-env, …  
6. **assets** — offline: copy `vendor/` → system paths; online: CDN `sync-assets`  
7. **verify logos** — sha256 vs `cloud-agent-assets.tsv`  
8. **opt dirs** — `/opt/cursor/{artifacts,recording-staging,logs}`  
9. **capture** `/tmp/vnc-desktop-user-env` for the VNC user  
10. **ansible-playbook** `vnc-desktop.yml` — apt packages, themes, noVNC, Chrome, XFCE config  
11. **verify logos** again  
12. **~/.cursor** helpers from `home-dot-cursor/`

Detailed component reference: [docs/COMPONENTS.md](docs/COMPONENTS.md).

## Offline vs online assets

| Mode | When to use | Network |
|------|-------------|---------|
| `offline` (default) | Clean install from git clone with `vendor/` | No (for assets) |
| `online` | Vendor missing or refreshing from CDN | Yes |
| `auto` | Use vendor if present, else CDN | Maybe |

CDN base URL (`config.env`):

```text
https://public-asphr-vm-daemon-bucket.s3.us-east-1.amazonaws.com/cloud-agent-assets/{sha256}{suffix}
```

Full URL list: `cloud-agent-assets.urls.json`.

### Refresh vendor from CDN (maintainers)

On a machine with internet:

```bash
cd ubuntu-cursor-env
./scripts/download-vendor-assets.sh   # re-downloads all 31 files into vendor/
git add vendor cloud-agent-assets.urls.json
```

Commit `vendor/` so clean installs never depend on S3.

## Troubleshooting

### Preflight: vendor missing

```bash
./scripts/download-vendor-assets.sh
```

Then re-run `sudo ./config.sh`.

### CDN returns 403/404

Use offline mode (default). Ensure `vendor/cloud-agent-assets/` exists in your clone.

### Ansible fails on apt

- Check internet and DNS  
- `sudo apt-get update` manually  
- Ubuntu mirrors must be reachable (Chrome + XFCE packages)

### Google Chrome install fails on ARM64 (`ubuntu-ports`, `arm64`)

Google's apt repo only ships **amd64** Chrome. On ARM64, `install-google-chrome.sh` automatically installs **Chromium** and symlinks `/usr/bin/google-chrome-stable` so the rest of the playbook works.

If you already hit the amd64 error, clean up and re-run:

```bash
sudo rm -f /etc/apt/sources.list.d/google-chrome.list
sudo rm -f /usr/local/bin/install-google-chrome.sh.version
sudo apt-get update
sudo ansible-playbook /opt/cursor/ansible/vnc-desktop.yml \
  --connection=local -i localhost, \
  -e vnc_user=ubuntu \
  --start-at-task "Install Google Chrome setup and package"
```

Or pull the latest `ubuntu-cursor-env` and run `sudo ./config.sh` again.

### Google Chrome install fails (amd64)

`install-google-chrome.sh` downloads from Google. Proxy/firewall must allow `dl.google.com`.

### Logos missing in panel

```bash
sudo ./scripts/verify-cursor-logos.sh
sudo gtk-update-icon-cache -f /usr/share/icons/hicolor
# Re-apply XFCE config for user:
sudo ANYOS_DESKTOP_APPEARANCE=light /usr/local/bin/configure-os-display <version> /usr/local/bin/configure_os_display.sh.version ubuntu light
```

### Re-running `desktop-init.sh` while VNC is already up

Do **not** run a full init on a live desktop unless you mean to restart VNC. A second `tigervncserver :1` fails with "already running" (harmless if you use the idempotent script). Older scripts also wiped `/tmp/.X11-unix` while X was up — avoid that.

- **Plank only:** `sudo bash /path/to/ubuntu-cursor-env/scripts/restart-plank.sh`
- **Full VNC restart:** `sudo -u ubuntu tigervncserver -kill :1`, then `sudo ANYOS_FORCE_VNC_RESTART=1 /usr/local/share/desktop-init.sh`

### noVNC missing (`/usr/local/novnc` not found)

Re-run the playbook or install script from the repo: `ansible/files/install-remote-vnc-setup.sh` (installs to `/usr/local/novnc/`). Raw VNC on port 5901 still works without noVNC.

### Plank keeps restarting (`Plank exited, restarting...`)

Two common causes:

1. **No session D-Bus** — Plank must use the bus from `xfce4-session` (`~/.dbus/session-bus/*`), not `autolaunch:`.
2. **`sudo -u` drops env** — Even with a valid bus address, `sudo -u ubuntu plank` strips `DBUS_SESSION_BUS_ADDRESS`. Current `desktop-init.sh` uses `sudoUserEnvIf` to pass `DISPLAY`, D-Bus, and XDG vars explicitly.

xstartup uses `dbus-run-session -- startxfce4`. Logs: `/tmp/plank.log`, `/tmp/bamfdaemon.log`.

On a running VM:

```bash
sudo apt-get install -y bamfdaemon dbus-x11
# deploy latest /usr/local/share/desktop-init.sh from this repo, then:
sudo pkill plank bamfdaemon 2>/dev/null || true
sudo rm -f /tmp/plank.log /tmp/bamfdaemon.log
grep DBUS_SESSION_BUS_ADDRESS /home/ubuntu/.dbus/session-bus/* | tail -1
sudo /usr/local/share/desktop-init.sh
tail -30 /tmp/plank.log
```

Manual test (replace `ADDR` and user):

```bash
ADDR=$(grep '^DBUS_SESSION_BUS_ADDRESS=' /home/ubuntu/.dbus/session-bus/* | head -1 | cut -d= -f2- | tr -d "'\"")
sudo -u ubuntu env DISPLAY=:1 DBUS_SESSION_BUS_ADDRESS="$ADDR" XDG_CURRENT_DESKTOP=XFCE plank -d
```

### HiDPI (4K)

```bash
sudo cp /opt/cursor/ansible/files/anyos.hidpi.conf /usr/local/share/anyos.conf
sudo /opt/cursor/ansible/files/install-hidpi-assets.sh
sudo anyos-setup /home/ubuntu
```

## What is NOT installed

| Component | Reason |
|-----------|--------|
| `/exec-daemon` (~200MB) | Injected at runtime by Cursor controller |
| `~/.cursor/plugins` cache | IDE-specific; huge |
| Convex / project deps | This is OS desktop only |

## File index

| Path | Purpose |
|------|---------|
| `config.sh` | Main installer |
| `config.env` | CDN URL, asset mode, prerequisite version |
| `INSTALL.md` | This guide |
| `docs/COMPONENTS.md` | Per-component reference |
| `SYSTEM_PATHS.md` | Target system paths |
| `scripts/preflight.sh` | Pre-install checks |
| `scripts/download-vendor-assets.sh` | Populate `vendor/` from CDN |

## Uninstall

There is no automatic uninstaller. To remove: purge XFCE/VNC packages via `apt`, delete `/opt/cursor`, remove `/usr/local/bin/install-*` and `/usr/local/share/cloud-agent-media`, and reset user `~/.config/xfce4`.
