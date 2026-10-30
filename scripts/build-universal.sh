#!/usr/bin/env bash
set -euo pipefail

# Development-only Universal Binary build (unsigned). For a signed, notarized release use
# scripts/release-macos.sh.

rustup target add aarch64-apple-darwin x86_64-apple-darwin

cd "$(dirname "$0")/../apps/desktop"
pnpm install --frozen-lockfile
pnpm tauri build --target universal-apple-darwin --bundles dmg

echo "DMG: $(pwd)/../../target/universal-apple-darwin/release/bundle/dmg"
