# Wall-E Packaging

This document tracks the path from local native builds to a signed release.

## Current Goal

Create a local macOS build of the Wall-E desktop app from the Tauri shell in `apps/desktop/`.

The first package now has a GitHub-backed updater baseline. Code signing and notarization are still release hardening steps before broad distribution.

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

Because updater artifacts are enabled, release builds must have the updater signing key in the environment:

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat /Users/socrates/.tauri/wall-e-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run package
```

To verify only the macOS app updater bundle without the DMG step:

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat /Users/socrates/.tauri/wall-e-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri -- build --bundles app
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
apps/desktop/src-tauri/target/release/bundle/macos/Wall-E.app.tar.gz
apps/desktop/src-tauri/target/release/bundle/macos/Wall-E.app.tar.gz.sig
apps/desktop/src-tauri/target/release/bundle/dmg/Wall-E_0.1.1_aarch64.dmg
```

The `.tar.gz` and `.sig` files are used by the updater. The DMG remains useful for first install.

## What Gets Packaged Today

The current desktop package includes:

- Tauri native app shell
- Existing `interface/` renderer
- Native folder picker
- Local settings persistence through `~/.wall-e/settings.json`
- Hosted provider API key storage through the OS keychain
- GitHub Releases update checks through Tauri's signed updater

The current desktop package does not yet include:

- Signed/notarized macOS distribution
- Bundled Python runtime for machines without Python installed
- Managed TypeScript and Go sub-agent processes

## GitHub Updates

Wall-E uses Tauri's updater plugin with this endpoint:

```text
https://github.com/SocratesOteo/Wall-E/releases/latest/download/latest.json
```

The updater requires signed update bundles. This cannot be disabled. The public key is committed in `apps/desktop/src-tauri/tauri.conf.json`; the private key must stay secret.

Local private key path generated for this machine:

```text
/Users/socrates/.tauri/wall-e-updater.key
```

Before GitHub Actions can publish update releases, add these repository secrets:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

For the current local key, set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to an empty string. Put the private key file contents into `TAURI_SIGNING_PRIVATE_KEY`.

Release flow:

1. Bump `version` in `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/Cargo.toml`, and `apps/desktop/package.json`.
2. Commit the version bump.
3. Push a tag matching the app version:

```bash
git tag app-v0.1.1
git push origin app-v0.1.1
```

4. GitHub Actions runs `.github/workflows/release.yml`.
5. Review and publish the draft release.
6. Existing installed apps can use Settings -> Check Updates.

## Secrets

Provider, model, base URL, and project path live in `~/.wall-e/settings.json`.

Hosted provider API keys do not live in that file. Wall-E stores them in the OS keychain under the `Wall-E` service, using one entry per provider.

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
10. Add an update strategy. Done with Tauri updater + GitHub Releases.

## Notes

For development, use:

```bash
npm run dev
```

For local packaging, use:

```bash
npm run package
```
