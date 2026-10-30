# Shared types

`apps/desktop/src/lib/types.ts` mirrors the JSON shape produced by the Rust structs in
`crates/fm27-core/src/model.rs`, `store.rs` and `parse.rs`.

The current first slice keeps the contract explicit and small. The planned next step is to
generate these TypeScript definitions with `tauri-specta` so the Rust structs remain the
single source of truth. Until then, any field rename in the Rust models must be mirrored in
`types.ts` and exercised by the real-save integration test.
