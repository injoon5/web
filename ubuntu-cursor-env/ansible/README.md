# Shared VNC Desktop Ansible Playbook

This directory contains a shared Ansible playbook for installing VNC desktop environment
components across Cursor container images. Both public and internal images have full
feature parity for the VNC desktop experience.

## Overview

The `vnc-desktop.yml` playbook installs and configures:

- **TigerVNC server** - Remote desktop server
- **XFCE4 desktop environment** - Lightweight desktop
- **noVNC** - Web-based VNC client
- **Google Chrome** - Web browser
- **WhiteSur theme** - macOS-style GTK, icon, and cursor themes
- **Cursor logo** - Branding in the panel menu
- **Fonts** - macOS fonts, Cascadia Code, and system fonts
- **Fontconfig** - Font substitution for web font rendering
- **Plank dock** - macOS-style dock at bottom of screen
- **Desktop wallpaper** - macOS Tiger wallpaper
- **polished-renderer** - Native Rust-based video renderer for screen recordings

## Usage

Both Dockerfiles use the **repo root** as their build context, allowing them to access
the shared ansible directory without any symlinking or copying.

### Public Image (anyrun/public-images/universal/)

Build from the repo root:

```bash
# From repo root (everysphere/)
docker build -f anyrun/public-images/universal/Dockerfile -t cursor-universal:latest .
```

### Internal Image (.cursor/)

Build from the repo root:

```bash
# From repo root (everysphere/)
docker build --platform linux/amd64 -f .cursor/Dockerfile -t everysphere-dev:latest .
```

### At Container Runtime

To ensure dependencies are installed (useful when users build on top of the base image):

```bash
# Run the playbook to ensure all VNC dependencies are present
ansible-playbook /opt/cursor/ansible/vnc-desktop.yml --connection=local -i localhost,
```

## Configuration Variables

The playbook supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VNC_USER` | `ubuntu` | User to configure VNC for |
| `ANYOS_DESKTOP_APPEARANCE` | `light` | Top panel appearance: `light` (macOS black foreground) or `dark` (historical white foreground) |

## Files Structure

```
ansible/
├── vnc-desktop.yml          # Main playbook
├── README.md                 # This file
└── files/
    ├── cursor-logo.svg       # Cursor branding
    ├── desktop-init.sh       # Container entrypoint script
    ├── fonts/                # desktop fonts (placeholders in repo)
    │   ├── Inter/
    │   │   ├── Inter-Bold.ttf
    │   │   ├── Inter-BoldItalic.ttf
    │   │   ├── Inter-Italic.ttf
    │   │   ├── Inter-Medium.ttf
    │   │   ├── Inter-MediumItalic.ttf
    │   │   ├── Inter-Regular.ttf
    │   │   ├── Inter-SemiBold.ttf
    │   │   └── Inter-SemiBoldItalic.ttf
    │   ├── JetBrainsMono/
    │   │   ├── JetBrainsMono-Bold.ttf
    │   │   ├── JetBrainsMono-BoldItalic.ttf
    │   │   ├── JetBrainsMono-Italic.ttf
    │   │   └── JetBrainsMono-Regular.ttf
    │   ├── PublicSans/
    │   │   ├── PublicSans-Bold.ttf
    │   │   ├── PublicSans-BoldItalic.ttf
    │   │   ├── PublicSans-Italic.ttf
    │   │   └── PublicSans-Regular.ttf
    │   └── SourceSans3/
    │       └── SourceSans3-Regular.ttf
    ├── polished-renderer/    # Native video renderer (Rust)
    │   ├── Cargo.toml        # Standalone build config
    │   ├── assets/           # SVG assets (cursor icon)
    │   └── src/              # Rust source code
    └── xfce-config/          # XFCE desktop configuration
        ├── .Xmodmap
        └── .config/
            ├── autostart/
            ├── gtk-3.0/
            ├── plank/
            └── xfce4/
```

## VNC Ports

- **5900/5901**: TigerVNC server (raw VNC protocol)
- **26058**: noVNC/websockify web client (HTTP/WebSocket)

## Desktop Environment

The playbook configures a macOS-like desktop experience with:

- WhiteSur Light GTK theme
- WhiteSur icon theme
- WhiteSur cursor theme
- Cursor logo in the panel menu
- Plank dock with zoom effects
- Top panel with applications menu and clock
- XFCE4 terminal with light theme
- macOS Tiger wallpaper

## polished-renderer Location

The polished-renderer source code now lives in `packages/polished-renderer/`.
It is no longer built by this Ansible playbook during image creation.

Cloud agents receive polished-renderer through the exec-daemon package that is
downloaded at startup, which allows renderer updates without rebuilding snapshots.
