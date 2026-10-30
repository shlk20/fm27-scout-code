# FM27 Scout

macOS 上的 Football Manager 27 只读球探工具：Tauri 2 + Rust 解析核心 + React/TypeScript UI。

> 非官方工具，与 Sports Interactive / SEGA 无关。只读存档，不修改游戏，不联网，不上传任何数据。

## 当前状态

第 1 阶段可运行版本已经完成：

- 直接读取 FM27 `27.0.0+2486695` 存档，容器 / zstd / section 目录全部由 Rust 解析。
- 支持 Finder 双击 / 拖入 `.fm` 文件；解析前先复制只读快照，避免游戏保存中读到半截文件。
- 球员：46,273 条记录，含属性、隐藏属性、CA/PA、位置、性格、习惯、合同、身价、状态。
- 俱乐部：26,214 个，球队映射、声望、上赛季排名。
- 合同：44,341 份，含工资、起止日期、租借、条款。
- 与 Python `fmsave` oracle 全量逐字段对比：**0 差异**。
- 解析耗时约 **0.57 秒**（release，M 系列 Mac）。
- SQLite 缓存 + 服务端分页查询；CLI 与桌面 App 共用 `fm27-core`。
- React UI：筛选、排序、球员详情、2–4 人对比、CSV/JSON 导出、隐藏属性开关、浅色/深色主题。
- 分析中心：年龄/CA 分布、俱乐部实力榜、阵容深度、小妖雷达（年龄 + PA + CA 差距）。
- 快捷筛选：小妖、合同年、高潜、本地保存的自定义视图。

真实存档未提交到仓库；开发时通过环境变量指定。

## 目录

```text
apps/desktop/          Tauri 2 应用 + React UI
crates/fm27-core/      Rust 解析、SQLite、查询、导出
crates/fm27-cli/       fm27scout CLI
shared/schema.sql      SQLite schema
scripts/               Python oracle 导出与 Rust/oracle 对比
docs/                  布局、解析与验证说明
```

## 构建产物

已完成本地验证的构建：

```text
target/release/bundle/dmg/FM27 Scout_0.1.0_aarch64.dmg   # 3.8 MB
target/release/bundle/macos/FM27 Scout.app               # 由 --bundles app 生成
```

当前产物为 Apple Silicon（aarch64）。Universal Binary 使用
`scripts/build-universal.sh` 或 `pnpm tauri build --target universal-apple-darwin`。

## 开发环境

- macOS 14+
- Rust stable（`rustup`）
- Node 20+ / pnpm
- Python 3.12 + `fmsave`（仅用于 oracle 对比）

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 前端依赖
cd apps/desktop
pnpm install

# 开发模式
pnpm tauri dev
```

## CLI

```bash
cargo build --release -p fm27-cli

# 容器信息（不解压 game_db）
./target/release/fm27scout inspect "/path/to/save.fm"

# 完整解析报告
./target/release/fm27scout validate "/path/to/save.fm"

# 前 1000 名球员
./target/release/fm27scout players "/path/to/save.fm" --limit 1000 --format json

# 导出 CSV
./target/release/fm27scout players "/path/to/save.fm" --limit 50000 --format csv --output players.csv

# 解析并写入 SQLite 缓存
./target/release/fm27scout index "/path/to/save.fm" --db fm27scout.db
```

## 验证

```bash
# Rust 单元测试
cargo test -p fm27-core

# 真实存档回归测试（需要存档）
FM27_TEST_SAVE="$HOME/Library/Application Support/Sports Interactive/Football Manager 27/games/BB KING - Casciavit.fm" \
  cargo test -p fm27-core --release -- --ignored

# Python oracle 导出 + 对比
python3 -m venv .venv
.venv/bin/pip install -e .ref-fmsave    # 开发期本地克隆
.venv/bin/python scripts/oracle_export.py --output /tmp/oracle.json
.venv/bin/python scripts/compare_outputs.py /tmp/oracle.json /tmp/rust.json
```

参考结果见 [docs/validation.md](docs/validation.md)。

## 安全边界

- 不修改 `.fm` 存档，不读取游戏内存，不注入进程。
- 不启用 Tauri `shell` / 任意文件系统插件；只使用用户主动选择的文件。
- 不发起网络请求；CSP 限制本地资源。
- 隐藏属性默认关闭；开启时提示仅限单机使用。
- 数据库、日志、快照只写入 `~/Library/Application Support/com.fm27scout.app/`；快照解析后删除。

## 已知限制

- 当前只针对 build `27.0.0+2486695` 做了完整验证；其他 FM27 build 会降级并提示，不猜测字段。
- 国家/赛事名称尚未内置；国籍暂以 ID 展示。
- 合同条款、租借和合同链已解析；少数未观测的 fallback 结构会显式留空。
- Windows/Linux 暂不构建。
- macOS Developer ID 签名 / notarization 尚未配置；当前构建为 Apple Silicon（Universal Binary 待第 5 周）。

## 后续

1. 国家/赛事名称表与中文名称。
2. 角色评分、成长快照、伤病/停赛/租借视图。
3. 多列排序、更多无障碍细节与筛选联动完善。
4. Tauri Updater、Developer ID 签名、notarization、Universal DMG 发布。

## 许可证与归属

本项目代码使用 MIT。解析逻辑参考并移植自 [fmsave](https://github.com/rhiever/fmsave)（MIT）。详见 [THIRD_PARTY.md](THIRD_PARTY.md)。
