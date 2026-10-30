#!/usr/bin/env bash
set -euo pipefail

# Build, sign, notarize and verify a Universal macOS release.
#
# Local signing (certificate already in the login keychain):
#   APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
#   APPLE_ID="you@example.com" APPLE_PASSWORD="app-specific-password" \
#   APPLE_TEAM_ID="TEAMID" scripts/release-macos.sh
#
# CI can instead set APPLE_CERTIFICATE + APPLE_CERTIFICATE_PASSWORD and use either the
# Apple ID variables above or APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_PATH.
#
# Tauri performs codesign and notarization when the signing identity and credentials are
# present. This script adds the universal target, checks the result with lipo, codesign and
# Gatekeeper, and writes SHA-256 checksums next to the DMG.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/desktop"

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" && -z "${APPLE_CERTIFICATE:-}" ]]; then
  echo "error: set APPLE_SIGNING_IDENTITY (local keychain) or APPLE_CERTIFICATE (CI)" >&2
  exit 1
fi

if [[ -z "${APPLE_ID:-}" && -z "${APPLE_API_KEY:-}" ]]; then
  echo "error: set APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID or APPLE_API_KEY/APPLE_API_ISSUER/APPLE_API_KEY_PATH" >&2
  exit 1
fi

rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm install --frozen-lockfile

# Tauri reads APPLE_SIGNING_IDENTITY and the notarization credentials from the environment.
pnpm tauri build --target universal-apple-darwin --bundles app,dmg

APP="$ROOT/target/universal-apple-darwin/release/bundle/macos/FM27 Scout.app"
DMG_DIR="$ROOT/target/universal-apple-darwin/release/bundle/dmg"

echo "==> verifying universal binary"
BINARY="$(find "$APP/Contents/MacOS" -maxdepth 1 -type f -perm -111 | head -n 1)"
lipo -info "$BINARY"

echo "==> verifying code signature"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "==> verifying Gatekeeper assessment"
spctl --assess --type execute --verbose=4 "$APP"

echo "==> verifying notarization ticket"
xcrun stapler validate "$APP"
for dmg in "$DMG_DIR"/*.dmg; do
  # The app ticket is the one Gatekeeper needs. Some Tauri/bundler combinations staple the
  # DMG too; treat a missing DMG ticket as a warning rather than a release failure.
  xcrun stapler validate "$dmg" || echo "warning: DMG has no stapled ticket (app is notarized)"
done

echo "==> checksums"
shasum -a 256 "$DMG_DIR"/*.dmg | tee "$DMG_DIR/SHA256SUMS.txt"

echo "DMG: $DMG_DIR"
