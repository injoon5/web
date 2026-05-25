# Component reference

Every part of `ubuntu-cursor-env`, how it fits together, and what it installs on the system.

## Architecture overview

```text
ubuntu-cursor-env/
├── config.sh              ──► orchestrates full install
├── config.env             ──► CDN URL + ASSET_INSTALL_MODE
├── vendor/                ──► offline copy of CDN assets (31 files)
├── cloud-agent-tools/     ──► versioned install scripts (TSV → /usr/local/bin)
├── ansible/               ──► VNC desktop playbook + XFCE templates
├── home-dot-cursor/       ──► optional ~/.cursor files
└── scripts/               ──► preflight, download, verify, asset installers
```

Runtime layout after install:

```text
/opt/cursor/
├── ansible/               # synced playbook
├── cloud-agent-tools/current/  # bundle + cloud-agent-setup
├── artifacts/             # agent output (777)
├── recording-staging/       # screen recordings (777)
└── logs/                  # agent logs (777)

/usr/local/bin/              # install-* scripts, anyos-setup, configure-os-display
/usr/local/share/
├── anyos.conf             # 1920×1200 @ 96 DPI
├── cloud-agent-media/       # theme/font/VNC archives (from vendor)
└── desktop-init.sh          # VNC session entrypoint

/usr/share/backgrounds/      # macos-wallpaper + desktop-background-{1,2,3}.png
/usr/share/fonts/truetype/macos/   # Inter, JetBrains Mono, …
/usr/share/pixmaps/          # cursor-logo.svg, cursor-logo-dark.svg
/usr/local/novnc/            # noVNC + websockify (extracted at install)
```

---

## `config.sh`

Main entry point. Must run as **root**.

| Phase | Action |
|-------|--------|
| Preflight | `scripts/preflight.sh` — vendor complete, files present |
| User | Creates `VNC_USER` if missing |
| Apt | Installs ansible, python3, curl, jq, fontconfig, … |
| Ansible sync | `rsync ansible/` → `/opt/cursor/ansible/` |
| Tools bundle | Rsync `cloud-agent-tools/bundle/` → `/opt/cursor/cloud-agent-tools/<hash>/` |
| tools.tsv | Copies 14 scripts to `/usr/local/bin`, `/tmp/capture-vnc-user-env`, etc. |
| Assets | Offline vendor or online CDN (see below) |
| Logos verify | `verify-cursor-logos.sh` |
| Opt dirs | artifacts, logs, recording-staging |
| Capture env | `/tmp/vnc-desktop-user-env` (USER + HOME) |
| Ansible | `vnc-desktop.yml` — full desktop stack |
| Logos verify | again after playbook |
| Home | `rsync home-dot-cursor/` → `~/.cursor/` |

---

## `config.env`

| Variable | Purpose |
|----------|---------|
| `CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL` | S3 CDN prefix for hash-addressed blobs |
| `ASSET_INSTALL_MODE` | `offline` \| `online` \| `auto` |
| `CLOUD_AGENT_ASSET_PREREQUISITES_VERSION` | Passed to `cloud-agent-setup sync-assets` |

URL pattern: `{BASE}/{sha256}{suffix}` — documented in `cloud-agent-assets.urls.json`.

---

## `vendor/cloud-agent-assets/`

Offline mirror of every row in `cloud-agent-assets.tsv`. Directory layout matches destination paths:

```text
vendor/cloud-agent-assets/usr/share/pixmaps/cursor-logo.svg
vendor/cloud-agent-assets/usr/local/share/cloud-agent-media/WhiteSur-Light.tar.xz
…
```

**31 files**, ~41 MB. Populated by:

```bash
./scripts/download-vendor-assets.sh
```

Installed by `scripts/install-cloud-agent-assets-offline.sh` with hash verification.

### Asset categories

| Category | Destinations | Used by |
|----------|--------------|---------|
| macOS UI fonts | `/usr/share/fonts/truetype/macos/*.ttf` | XFCE, fontconfig substitutions |
| Cursor logos | pixmaps + hicolor 24×24 | XFCE panel `applicationsmenu` |
| Theme archives | `/usr/local/share/cloud-agent-media/*` | `install_and_configure_themes.sh`, fonts, noVNC |
| Wallpapers | `/usr/share/backgrounds/*.png` | XFCE desktop background |

---

## `cloud-agent-tools/bundle/`

Snapshot of `/opt/cursor/cloud-agent-tools/<hash>/` from a live cloud VM.

| File | Role |
|------|------|
| `cloud-agent-setup` | CLI: `sync-assets`, `run-step`, `wrap-vnc-step` |
| `cloud-agent-tools.tsv` | Maps bundle files → `/usr/local/bin` destinations |
| `cloud-agent-assets.tsv` | Maps CDN hashes → system asset paths |
| `cloud-agent-assets-manifest.json` | Human-readable source paths (everysphere monorepo) |
| `files/vnc/*.sh` | Idempotent install scripts (version file skip logic) |
| `files/anyos/*` | Display DPI/resolution config |

### `cloud-agent-tools.tsv` destinations

Installs to `/usr/local/bin` (names hyphenated):

- `install-vnc-desktop-apt-packages` — reads `vnc-desktop.Aptfile`
- `install-google-chrome` / `configure-google-chrome`
- `install-locales` — `en_US.UTF-8`
- `install-fonts-and-fontconfig` — Cascadia zip + `/etc/fonts/local.conf`
- `install-and-configure-themes` — WhiteSur GTK/icons/cursors
- `install-remote-vnc-setup` — noVNC 1.2.0 + websockify 0.10.0 → `/usr/local/novnc/`
- `configure-os-display` — XFCE templates + anyos-setup for VNC user
- `install-cursor-artifact-directories` — `/opt/cursor/artifacts`, etc.

Also: `/tmp/capture-vnc-user-env`, `/usr/local/share/anyos.conf`, `/usr/local/bin/anyos-setup`.

---

## `ansible/vnc-desktop.yml`

Self-contained playbook (no everysphere monorepo paths). Runs locally as root.

### Major task groups

1. **Copy install scripts** to `/usr/local/bin` (same as tools.tsv, from `ansible/files/`)
2. **Apt packages** — `install-vnc-desktop-apt-packages` + `vnc-desktop.Aptfile`
3. **Google Chrome / Chromium** — amd64: Google deb; **arm64: Chromium** + `google-chrome-stable` symlinks
4. **Locales** — `en_US.UTF-8`
5. **Cursor logos** — copy from `ansible/files/logos/` to pixmaps + hicolor
6. **macOS fonts** — copy `ansible/files/fonts/` → `/usr/share/fonts/truetype/macos/`
7. **Cascadia + fontconfig** — extract zip from `cloud-agent-media/`
8. **Themes** — extract WhiteSur archives
9. **noVNC** — extract zips, wire websockify
10. **desktop-init.sh**, **anyos.conf**, **anyos-setup** → `/usr/local/share` and `/usr/local/bin`
11. **Wallpapers** — `ansible/files/backgrounds/` → `/usr/share/backgrounds/`
12. **configure-os-display** — apply XFCE + Plank for `VNC_USER`
13. **Cursor artifact dirs** — `/opt/cursor/artifacts`, `recording-staging`
14. **Apt cleanup** — optional cache purge
15. **Version stamp files** — `.version` sidecars for idempotent scripts

Skipped vs upstream image build: monorepo hash baking, `install-baked-cloud-agent-tools.py` tarball (replaced by `config.sh` rsync).

---

## AnyOS (`anyos.conf` + `anyos-setup.sh`)

Central display configuration for 1920×1200 @ 96 DPI (1× scaling).

| Setting | Value |
|---------|--------|
| Resolution | 1920×1200×24 |
| DPI | 96 |
| UI font | Inter 11pt |
| Terminal font | JetBrains Mono 11pt |
| Panel height | 28px |
| Dock icons | 48px |

`anyos-setup.sh` substitutes placeholders (`ANYOS_DPI`, `ANYOS_PANEL_HEIGHT`, …) into:

- `.Xresources`
- `xsettings.xml`, `xfce4-panel.xml`, `xfwm4.xml`
- GTK `settings.ini`, Plank `settings`, `terminalrc`

`configure_os_display.sh` builds templates, runs `anyos-setup` on a temp dir, copies into `root` and `VNC_USER` home.

HiDPI: use `anyos.hidpi.conf` + `install-hidpi-assets.sh` (downloads xfwm4 assets from GitHub).

---

## XFCE configuration (`ansible/files/xfce-config/`)

Pre-baked templates copied and customized by `configure_os_display.sh`:

| File | Purpose |
|------|---------|
| `xfce4-panel.xml` | Top panel; **applications menu icon** = `cursor-logo` |
| `xfce4-panel.dark.xml` | Dark panel; icon = `cursor-logo-dark` |
| `xsettings.xml` | GTK theme WhiteSur-Light, icons WhiteSur |
| `xfwm4.xml` | Window decorations |
| `xfce4-desktop.xml` | Wallpaper path → `/usr/share/backgrounds/macos-wallpaper.png` |
| `plank/dock1/settings` | Bottom dock, WhiteSur-Light theme |
| `gtk-3.0/settings.ini`, `gtk.css` | GTK styling |

Plank launchers: Google Chrome, Thunar, XFCE Terminal.

---

## Cursor logos

| File | Hash (sha256) | Role |
|------|---------------|------|
| `cursor-logo.svg` | `4961e333…` | Light panel menu (pixmaps) |
| `cursor-logo-dark.svg` | `0a964657…` | Dark panel menu |
| `cursor-logo.png` (24×24) | `a6ca61d1…` | hicolor icon theme |
| `cursor-logo-dark.png` | `e0e7a7bc…` | hicolor dark |

XFCE references icon **names** `cursor-logo` / `cursor-logo-dark` (not full paths). GTK icon theme resolves via hicolor + pixmaps.

Verification: `scripts/verify-cursor-logos.sh` after asset install and Ansible.

---

## `cloud-agent-media/` archives

Installed under `/usr/local/share/cloud-agent-media/` before theme/noVNC scripts run.

| Archive | Install script |
|---------|----------------|
| `CascadiaCode-2008.25.zip` | `install-fonts-and-fontconfig.sh` → `/usr/share/fonts/truetype/cascadia/` |
| `WhiteSur-Light.tar.xz` | `install_and_configure_themes.sh` → `/usr/share/themes/WhiteSur-Light/` |
| `WhiteSur-icon-theme-master.tar.gz` | → `/usr/share/icons/WhiteSur/` |
| `WhiteSur-cursors-master.tar.gz` | → `/usr/share/icons/WhiteSur-cursors/` |
| `noVNC-1.2.0.zip` | `install-remote-vnc-setup.sh` → `/usr/local/novnc/` |
| `websockify-0.10.0.zip` | linked under noVNC `utils/websockify` |

---

## `desktop-init.sh`

Container/VM entrypoint after install. Sources `anyos.conf`, starts D-Bus, Xvnc, XFCE, Plank, noVNC.

| Env | Default |
|-----|---------|
| `VNC_PORT` | 5901 |
| `NOVNC_PORT` | 26058 |
| `DISPLAY` | `:1 |

Logs: `/tmp/container-init.log`.

---

## `home-dot-cursor/`

Optional; not the full IDE plugin cache.

| Path | Purpose |
|------|---------|
| `bin/cursor-git-ssh-keygen` | SSH key helper for git over HTTPS |
| `agent-hooks/L3dvcmtzcGFjZQ/` | Git `commit-msg` / `pre-commit` hooks (workspace-specific hash dir) |

Replace `L3dvcmtzcGFjZQ` with your workspace hook id if needed.

---

## Helper scripts (`scripts/`)

| Script | When |
|--------|------|
| `preflight.sh` | Before install; fails if vendor incomplete |
| `download-vendor-assets.sh` | Maintainer: refresh `vendor/` from CDN |
| `generate-asset-urls.sh` | Regenerate `cloud-agent-assets.urls.json` |
| `install-cloud-agent-assets-offline.sh` | Copy vendor → system (hash check) |
| `install-cloud-agent-assets-online.sh` | `cloud-agent-setup sync-assets` |
| `verify-cursor-logos.sh` | Post-install logo check |
| `install-opt-cursor-dirs.sh` | `/opt/cursor` runtime directories |

---

## `vnc-desktop.Aptfile`

Package list for the desktop stack: TigerVNC, XFCE4, Plank, Mesa software GL, Python (websockify), fonts, ffmpeg, etc. See file for full list (~85 lines).

---

## Runtime-only (not in bundle)

| Path | Notes |
|------|-------|
| `/exec-daemon/` | Node, gh, cursorsandbox — ~200MB; controller injects |
| `~/.cursor/plugins/` | IDE cache |
| `/usr/local/bin/gh` | Often symlink to `/exec-daemon/gh` on cloud VMs |

---

## Idempotent versioning

Install scripts skip work when `{script}.version` matches the SHA256 of the script/Aptfile inputs. Ansible writes these `.version` files at the end of the playbook.

To force re-run: delete the relevant `.version` file under `/usr/local/bin/` or `/usr/share/`.

---

## Related docs

- [INSTALL.md](../INSTALL.md) — step-by-step install
- [SYSTEM_PATHS.md](../SYSTEM_PATHS.md) — path inventory
- [README.md](../README.md) — short overview
