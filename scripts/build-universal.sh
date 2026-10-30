#!/usr/bin/env bash
set -euo pipefail

# Build a macOS Universal Binary DMG. Requires both Rust targets.
rustup target add aarch64-apple-darwin x86_64-apple-darwin

cd "$(dirname "$0")/../apps/desktop"
pnpm install --frozen-lockfile
pnpm tauri build --target universal-apple-darwin --bundles dmg

echo "DMG: $(pwd)/../../target/universal-apple-darwin/release/bundle/dmg"
