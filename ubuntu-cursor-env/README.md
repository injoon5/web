# Ubuntu Cursor Cloud Agent Environment

Reproduces the Cursor **Cloud Agent** Ubuntu desktop stack on a clean machine: TigerVNC, XFCE4, noVNC, Chrome, WhiteSur theme, AnyOS display tuning, wallpapers under `/usr/share/backgrounds/`, and `/opt/cursor` layout.

Extracted from a running cloud VM:

- `/opt/cursor/ansible/vnc-desktop.yml`
- `/opt/cursor/cloud-agent-tools/current/files/anyos/anyos-setup.sh`
- `/usr/share/backgrounds/*.png`

## Quick start

On a fresh **Ubuntu 22.04+** (amd64), as root:

```bash
git clone <this-repo>
cd <repo>/ubuntu-cursor-env
chmod +x config.sh
sudo ./config.sh
```

Optional environment variables (see also `config.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VNC_USER` | `ubuntu` | Desktop user (created if missing) |
| `ANYOS_DESKTOP_APPEARANCE` | `light` | `light` or `dark` top panel |
| `CURSOR_HOME` | `/home/$VNC_USER/.cursor` | Target for bundled `home-dot-cursor/` helpers |
| `CLOUD_AGENT_ASSETS_DOWNLOAD_BASE_URL` | see `config.env` | CDN base for hash-addressed assets |
| `ASSET_INSTALL_MODE` | `offline` | `offline`, `online`, or `auto` |

### Asset download URLs

Content-addressed assets are fetched from:

`https://public-asphr-vm-daemon-bucket.s3.us-east-1.amazonaws.com/cloud-agent-assets/{sha256}{suffix}`

Full list: `cloud-agent-assets.urls.json` (regenerate with `scripts/generate-asset-urls.sh`).

For online install only:

```bash
ASSET_INSTALL_MODE=online sudo ./config.sh
```

### Cursor logos

Installed to:

- `/usr/share/pixmaps/cursor-logo.svg` and `cursor-logo-dark.svg`
- `/usr/share/icons/hicolor/24x24/apps/cursor-logo.png` and `cursor-logo-dark.png`

XFCE panel references `cursor-logo` / `cursor-logo-dark` (see `configure_os_display.sh`).  
`config.sh` runs `scripts/verify-cursor-logos.sh` after asset install and after Ansible.

## What `config.sh` does

1. Installs **Ansible**, Python 3, rsync, curl, jq, fontconfig via `apt`.
2. Rsyncs `ansible/` → `/opt/cursor/ansible/`.
3. Installs the vendored **cloud-agent-tools** bundle under `/opt/cursor/cloud-agent-tools/<hash>/` and symlinks `current`.
4. Installs bundled scripts to `/usr/local/bin` and `/usr/local/share` via `cloud-agent-tools.tsv` (offline; no download URL).
5. Installs **cloud-agent assets** from `vendor/cloud-agent-assets/` via `cloud-agent-assets.tsv` (fonts, `cloud-agent-media` archives, wallpapers, logos).
6. Creates `/opt/cursor/{artifacts,recording-staging,logs,.exec-daemon}` (exec-daemon binary is runtime-only).
7. Captures `/tmp/vnc-desktop-user-env` for the VNC user (used by Chrome/display scripts).
8. Runs `ansible-playbook /opt/cursor/ansible/vnc-desktop.yml --connection=local -i localhost,`.
9. Copies small **~/.cursor** helpers from `home-dot-cursor/` (bin, agent-hooks).

Full path list: [SYSTEM_PATHS.md](./SYSTEM_PATHS.md).

After a successful run you should have the same system paths as the cloud image:

| Path | Purpose |
|------|---------|
| `/opt/cursor/ansible/` | Playbook + `files/` |
| `/opt/cursor/cloud-agent-tools/current/` | VNC/AnyOS install scripts |
| `/opt/cursor/artifacts/` | Agent artifacts (created by playbook step) |
| `/usr/share/backgrounds/macos-wallpaper.png` | Default wallpaper |
| `/usr/share/backgrounds/desktop-background-{1,2,3}.png` | Alternate wallpapers |
| `/usr/local/bin/anyos-setup` | Substitute AnyOS placeholders into XFCE configs |
| `/usr/local/share/anyos.conf` | 1920×1200 @ 96 DPI defaults |

## Manual equivalents

```bash
# Playbook only (if tree already at /opt/cursor/ansible)
sudo ansible-playbook /opt/cursor/ansible/vnc-desktop.yml --connection=local -i localhost,

# Per-user AnyOS template substitution (after playbook)
sudo anyos-setup /home/ubuntu

# Re-run AnyOS setup from vendored source
sudo cp ubuntu-cursor-env/ansible/files/anyos.conf /usr/local/share/
sudo cp ubuntu-cursor-env/ansible/files/anyos-setup.sh /usr/local/bin/anyos-setup
```

## Directory layout

```
ubuntu-cursor-env/
├── config.sh                 # Main installer (run with sudo)
├── README.md
├── SYSTEM_PATHS.md           # Every system path used by setup
├── scripts/
│   ├── install-cloud-agent-assets-offline.sh
│   └── install-opt-cursor-dirs.sh
├── vendor/
│   └── cloud-agent-assets/   # Offline mirror of cloud-agent-assets.tsv destinations
├── home-dot-cursor/          # ~/.cursor bin + agent-hooks (not plugin cache)
├── cloud-agent-tools/
│   └── bundle/               # Vendored cloud-agent-tools snapshot
│       ├── cloud-agent-setup
│       ├── cloud-agent-tools.tsv
│       ├── cloud-agent-assets.tsv
│       └── files/{anyos,vnc}/
└── ansible/
    ├── vnc-desktop.yml       # Self-contained playbook (local file paths)
    ├── README.md             # Upstream Ansible docs
    └── files/
        ├── backgrounds/      # desktop_background_0..3.png
        ├── fonts/            # Inter, JetBrains Mono, etc. (macOS UI fonts)
        ├── logos/            # Cursor panel branding
        ├── xfce-config/      # XFCE/GTK/Plank templates
        ├── anyos.conf
        ├── anyos-setup.sh
        └── *.sh              # VNC install/configure scripts
```

## Differences from the internal everysphere image build

The upstream playbook at `/opt/cursor/ansible/vnc-desktop.yml` references `packages/agent-controller/assets/...` in the monorepo. This bundle **vendors** those assets and rewrites paths to `ansible/files/`.

Skipped (handled differently here):

- **CDN asset downloads** — replaced by `vendor/cloud-agent-assets/` + `scripts/install-cloud-agent-assets-offline.sh`.
- **install-baked-cloud-agent-tools.py** tarball bake — replaced by rsync + TSV installers in `config.sh`.
- **`/exec-daemon`** (~200MB runtime) — not vendored; see `SYSTEM_PATHS.md`.
- **`~/.cursor/plugins`** cache — not vendored.

Cascadia Code is extracted at install time from the vendored `CascadiaCode-2008.25.zip` in `cloud-agent-media/`.

## HiDPI

For 4K / 2× scaling, after install:

```bash
sudo cp /opt/cursor/ansible/files/anyos.hidpi.conf /usr/local/share/anyos.conf
sudo /opt/cursor/ansible/files/install-hidpi-assets.sh
sudo anyos-setup /home/ubuntu
```

## VNC ports

- `5900` / `5901` — TigerVNC
- `26058` — noVNC / websockify

Start the desktop with `/usr/local/share/desktop-init.sh` (installed by the playbook).
