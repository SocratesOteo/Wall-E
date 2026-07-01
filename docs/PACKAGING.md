# Wall-E Packaging

This document tracks the path from local native builds to a signed release.

## Current Goal

Create a local macOS build of the Wall-E desktop app from the Tauri shell in `apps/desktop/`.

The first package does not need signing, notarization, auto-update, or a polished icon. Those are release hardening steps after the brain bridge works.

## Prerequisites

- macOS
- Node.js and npm
- Rust and Cargo
- Xcode Command Line Tools
- Full Xcode for later signed/notarized distribution work

Check the local environment:

```bash
cd apps/desktop
npm run info
```

## Local Package Build

Install dependencies:

```bash
cd apps/desktop
npm install
```

Build the native package:

```bash
npm run package
```

Expected outputs are under:

```text
apps/desktop/src-tauri/target/release/
apps/desktop/src-tauri/target/release/bundle/
```

The exact bundle files depend on the host OS and installed platform tooling.

Current macOS local build outputs:

```text
apps/desktop/src-tauri/target/release/bundle/macos/Wall-E.app
apps/desktop/src-tauri/target/release/bundle/dmg/Wall-E_0.1.0_aarch64.dmg
```

## What Gets Packaged Today

The current desktop package includes:

- Tauri native app shell
- Existing `interface/` renderer
- Native folder picker
- Local settings persistence through `~/.wall-e/settings.json`

The current desktop package does not yet include:

- Embedded Python brain runner
- Sub-agent process management
- API key setup UI
- Signed/notarized macOS distribution
- Auto-updates

## Release Hardening Checklist

1. Replace the placeholder icon with production app icons.
2. Add full macOS app metadata.
3. Decide whether Wall-E bundles Python or requires a local Python install.
4. Add a brain sidecar or managed local service.
5. Add first-run setup for provider API keys.
6. Add smoke tests for app launch, project picker, settings persistence, and first message.
7. Add code signing.
8. Add notarization.
9. Add release artifact naming and checksums.
10. Add an update strategy.

## Notes

For development, use:

```bash
npm run dev
```

For local packaging, use:

```bash
npm run package
```
