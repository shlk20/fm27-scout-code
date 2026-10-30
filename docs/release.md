# macOS 签名、Notarization 与 Universal Binary

FM27 Scout 使用 Tauri 2 的 macOS 打包链：`codesign`、hardened runtime、`notarytool`
notarization 和 stapler 都由 Tauri 在检测到签名身份后执行。

## 前置条件

- Apple Developer Program 账号。
- `Developer ID Application` 证书（不要用 Apple Distribution，除非上架 App Store）。
- App 专用密码（Apple ID 流程）或 App Store Connect API Key（API 流程）。

本机查看可用签名身份：

```bash
security find-identity -v -p codesigning
```

## 本机构建

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"

scripts/release-macos.sh
```

脚本会：

1. 安装 `aarch64-apple-darwin` 与 `x86_64-apple-darwin` target。
2. 构建 Universal `.app` + `.dmg`。
3. 用 `lipo` 检查双架构。
4. 用 `codesign --verify --deep --strict` 检查签名。
5. 用 `spctl --assess` 与 `xcrun stapler validate` 检查 Gatekeeper 与公证票据。
6. 生成 `SHA256SUMS.txt`。

产物：

```text
target/universal-apple-darwin/release/bundle/macos/FM27 Scout.app
target/universal-apple-darwin/release/bundle/dmg/FM27 Scout_0.2.0_universal.dmg
```

## CI

`.github/workflows/release.yml` 从 GitHub Secrets 读取：

| Secret | 用途 |
|---|---|
| `APPLE_CERTIFICATE` | 导出的 `.p12` 的 base64 |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` 密码 |
| `APPLE_SIGNING_IDENTITY` | 例如 `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Apple ID 公证 |

本机也可以使用 App Store Connect API Key（`APPLE_API_KEY`、`APPLE_API_ISSUER`、
`APPLE_API_KEY_PATH`）；CI 默认走 Apple ID 流程。

推送 `v*` tag 或手动触发 workflow。构建会运行 Rust/前端测试，签名，公证，验证双架构，
上传 DMG 与校验和。

## 配置

- `apps/desktop/src-tauri/tauri.conf.json`：`hardenedRuntime: true`，
  `minimumSystemVersion: 14.0`，entitlements 指向 `entitlements.plist`。
- `apps/desktop/src-tauri/entitlements.plist`：WKWebView 在 hardened runtime 下需要的
  JIT 权限。
- 不启用 App Sandbox；当前发布方式为 Developer ID + DMG。

## 本地验证

```bash
hdiutil attach "target/universal-apple-darwin/release/bundle/dmg/FM27 Scout_0.2.0_universal.dmg"
cp -R "/Volumes/FM27 Scout/FM27 Scout.app" /tmp/
codesign --verify --deep --strict /tmp/"FM27 Scout.app"
spctl --assess --type execute -vv /tmp/"FM27 Scout.app"
```

没有签名环境时仍可用 `pnpm tauri build --bundles app` 做本地调试构建；该构建不应发布。
