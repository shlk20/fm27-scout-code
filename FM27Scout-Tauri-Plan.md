# FM27 Scout — Tauri + Rust macOS 开发计划

- 文档版本：0.2
- 日期：2026-10-30
- 目标平台：**macOS 14+**（Apple Silicon + Intel；Windows/Linux 暂缓）
- 技术路线：**Tauri 2 + Rust 解析核心 + React/TypeScript Web UI**
- 参考存档：`BB KING - Casciavit.fm`（FM27 `27.0.0+2486695`）
- 当前状态：**方案定稿，待进入实现阶段**

### 已确认决策

- 前端：**React + TypeScript**（Vite + Tailwind + shadcn/ui + TanStack Table）。
- 平台：**只做 macOS**，Windows/Linux 暂缓。
- 隐藏属性：**默认关闭**；开启时提示仅限单机使用。
- 开发方式：**CLI、数据层、UI 并行**，不再按“先 CLI 后 UI”串行。

---

## 1. 项目目标

做一个类似 MacScout26 的 macOS 足球经理球探工具，采用 Tauri + Rust + Web UI 路线：

- 直接读取 `.fm` 存档，不读取游戏内存、不要求关闭 SIP。
- 查看球员全部可见属性、隐藏属性、CA/PA、性格、位置、合同、身价等。
- 支持搜索、排序、组合筛选、球员对比、CSV/JSON 导出。
- 默认只读：不修改存档，不联网，不上传任何数据。
- 当前只交付 macOS 版本；解析核心保持平台无关，Windows/Linux 后续再评估。

核心用户场景：

1. 打开存档，几秒内看到全部球员。
2. 按俱乐部、位置、年龄、CA/PA、属性、合同等条件筛选。
3. 点开球员，查看完整属性面板和隐藏信息。
4. 选中 2–4 名球员做对比。
5. 把当前筛选结果导出为 CSV，用于外部分析。

---

## 2. 可行性结论（已用真实存档验证）

已对 `BB KING - Casciavit.fm` 做只读解析验证，未修改存档：

| 项目 | 结果 |
|---|---|
| 存档大小 | 49.0 MB |
| 游戏版本 | FM27 `27.0.0+2486695` |
| 游戏内日期 | 2026-07-13 |
| 容器格式 | 26 字节 header + 多个 zstd frame + trailer 目录 |
| Section 数量 | 75 |
| `game_db` 解压后 | 约 137 MB |
| 全部 section 解压后 | 约 192.5 MB |
| 球员记录 | **46,273 条** |
| 俱乐部 | **26,213 个** |
| 球队 | **60,334 支** |
| 合同 | **44,341 份** |
| Python 参考实现耗时 | 约 **4.8 秒** |

示例：Luka Modrić

```text
俱乐部：Casciavit Milano
年龄：40
位置：MC / DM
CA / PA：158 / 180
隐藏属性：稳定 17、大赛 18、受伤倾向 5、肮脏 12、多面性 16
性格：职业 20、雄心 15、忠诚 17、抗压 17、气质 16、争议 5
合同：工资 106,965（存档单位）/ 周，到期 2027-06-30
```

结论：

- 球员属性、隐藏属性、CA/PA、位置、性格、习惯、合同、身价都可读。
- 不需要读内存，不需要注入游戏进程。
- 主要工作量在“把已验证的解析逻辑产品化”，而不是从零逆向格式。
- Rust 重写后，解析目标可以做到 **2 秒以内**。

---

## 3. 产品范围

### 3.1 MVP 必须包含

- 选择/拖入 `.fm` 存档。
- 自动识别 FM27 版本和存档信息。
- 解析并缓存到本地 SQLite。
- 球员表格：
  - 姓名、年龄、俱乐部、国籍、位置、CA、PA、身价、工资、合同到期。
  - 搜索、排序、列显示/隐藏、列宽调整。
- 组合筛选：
  - 姓名/俱乐部关键字
  - 国籍、年龄区间
  - 位置（可用球场选位）
  - CA/PA 区间
  - 任意属性最小/最大值
  - 身价、工资、合同到期
  - 隐藏属性开关
- 球员详情：
  - 技术、精神、身体、门将属性
  - 隐藏属性、性格
  - CA/PA、位置评分、习惯动作
  - 身高、左右脚、体质、比赛状态
  - 俱乐部、合同、身价
- 2–4 名球员对比。
- 导出当前筛选结果或选中球员为 CSV/JSON。
- 只读、本地、无网络。

### 3.2 后续版本

- 阵容深度/年龄结构分析。
- 角色评分（按 FM 角色权重计算）。
- 小妖筛选（年龄 + PA + CA 差距）。
- 存档快照与成长曲线。
- 伤病、停赛、租借视图。
- 游戏内 shortlist 读取。
- 自定义视图/筛选预设。
- 中英文界面切换。

### 3.3 暂不做

- 修改存档。
- 读取游戏内存。
- 线上联赛/对战辅助。
- 自动下载外部数据库或名称包。
- 云同步、账号系统、遥测。

---

## 4. 技术选型

| 层 | 选型 | 说明 |
|---|---|---|
| 桌面壳 | **Tauri 2** | macOS 原生窗口/菜单，体积小 |
| 解析核心 | **Rust** | 性能好、内存安全、可复用到 CLI |
| 前端 | **React + TypeScript + Vite** | 生态成熟，表格/图表组件多 |
| 样式 | **Tailwind CSS + shadcn/ui** | 快速做出接近原生的界面 |
| 表格 | **TanStack Table + TanStack Virtual** | 46k 行虚拟滚动、列自定义 |
| 图表 | **Recharts** | 属性雷达图、成长曲线 |
| 状态 | **Zustand + TanStack Query** | 本地 UI 状态 + 异步查询 |
| 数据库 | **SQLite + rusqlite（bundled）** | 无需用户安装数据库 |
| 压缩 | **zstd crate** | 解析存档内的 zstd frame |
| CLI | **clap** | `fm27scout inspect/export/validate` |
| 测试 | cargo test / Vitest / Playwright / GitHub Actions | Rust、前端、端到端、macOS CI |

### 为什么选路线 3

- Tauri 2 在 macOS 上使用系统 WKWebView，产物比 Electron 小很多，内存占用也更低。
- Rust 解析核心性能足够，且可以单独做 CLI，方便验证和调试。
- React 的表格、筛选、图表生态成熟，适合做 46k 行级别的球探表格。
- macOS-only 可以先专注一套交互和打包流程，后续再评估 Windows/Linux。
- 解析核心与 UI 解耦，未来扩展到其他平台时不需要重写数据层。

### 需要接受的取舍

- 不是 100% 原生控件；UI 由 macOS WKWebView 渲染。
- 需要针对 macOS 处理窗口、菜单、快捷键和 notarization 细节。
- 打包、签名、更新机制比纯 Swift 稍复杂，但 Tauri 已提供完整工具链。

### 4.1 最终决策

- 前端使用 **React + TypeScript**，不再保留 Svelte/Vue 分支。
- 目标平台 **macOS 14+**，构建 Universal Binary。
- 隐藏属性默认关闭，开启时提示仅限单机使用。
- CLI、SQLite、Tauri UI 从第 1 周起并行推进。

---

## 5. 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│                         Tauri App (macOS)                    │
│                                                             │
│  React + TypeScript + Tailwind + shadcn/ui                  │
│  ├─ SavePicker / RecentSaves                                │
│  ├─ PlayerTable (TanStack Table + Virtual)                  │
│  ├─ FilterSidebar / FilterPresets                           │
│  ├─ PlayerInspector / AttributeBars                         │
│  ├─ CompareView                                             │
│  └─ ExportDialog                                            │
│                          │                                  │
│                    Tauri commands                           │
│                          │                                  │
│  Rust backend                                               │
│  ├─ SaveService: 路径、指纹、快照、缓存                     │
│  ├─ ParseService: 调用 fm27-core，进度事件                  │
│  ├─ QueryService: SQLite 分页查询、筛选、排序               │
│  └─ ExportService: CSV / JSON                               │
│                          │                                  │
│  fm27-core (Rust crate)                                     │
│  ├─ container: header / zstd / trailer                      │
│  ├─ layouts: FM27 profile + FM26 fallback                   │
│  ├─ gamedb: names / players / persons / clubs / contracts   │
│  ├─ normalize: 原始值 → 显示值、日期、缺失值                │
│  └─ validate: 不变量、覆盖率、异常报告                      │
│                          │                                  │
│  SQLite (app data dir)                                      │
└─────────────────────────────────────────────────────────────┘
```

关键原则：

- **解析与 UI 解耦**：UI 只查 SQLite，不直接理解二进制格式。
- **解析与查询解耦**：Rust 负责解析和写入，前端只发查询条件。
- **CLI 与 App 共用核心**：`fm27-core` 同时服务 Tauri 和 `fm27scout` CLI。
- **Python 只作为验证 oracle**：开发期用已验证的 Python 实现做对照，不进入最终产品。

---

## 6. 解析核心设计

### 6.1 容器层

FM27 存档容器（已在此存档验证）：

- 文件头 26 字节，magic 为 `02 01 "fmf."`。
- 偏移 9 处的 u64 指向 trailer 目录（实际 trailer 位置 = 9 + 该值）。
- trailer 内含一个 zstd frame，解压后是 section 目录。
- 目录条目包含：section 名称、扩展名、frame 偏移、压缩大小、解压大小、两个尾部值。
- 主体由多个 zstd frame 组成，按目录读取，不要假设只有一个 frame。
- 读取时必须设置解压上限，防止损坏文件或 zstd bomb。

Rust 模块：

```text
container.rs
  ├─ SaveFile::open(path)
  ├─ read_header()
  ├─ read_trailer_directory()
  ├─ section(name) -> SectionReader
  ├─ decompress_frame(offset, compressed_size, expected_size)
  └─ fingerprint() -> size + mtime + hash(header + trailer)
```

### 6.2 FM27 布局差异

已确认的关键差异：

| 区域 | FM27 情况 | 处理方式 |
|---|---|---|
| 容器 | 与 FM26 基本一致 | 直接复用 container 逻辑 |
| `game_db` schema | 4000，未变 | 使用 FM26 26.3.2 布局 |
| 球员记录 | 布局未变 | marker + 完整性扫描 |
| 人员块 | **整体后移 1 字节** | `personality_offset=22`，零区 `15/6` |
| 俱乐部 counted table | framing 变化 | MVP 绕过绑定；正式版补 FM27 layout |
| `game_info` schema 47 | 有变化 | 游戏日期走 `save_game_summary` fallback |
| `save_game_summary` schema 31 | 有变化 | 读取版本和日期，补 FM27 layout |
| 其他 section | 部分新增/缺失/改 schema | 不影响球员球探，后续按需支持 |

人员块关键修正：

```text
FM26: personality_offset_from_birth = 21, zero_region = (14, 7)
FM27: personality_offset_from_birth = 22, zero_region = (15, 6)
```

### 6.3 球员记录布局（已在此存档验证）

```text
球员记录起点 = marker 位置 - 102
marker = 01 00 6c 07

+0    CA            u16
+2    PA            i16（负数表示随机/范围代码）
+16   team_id       u32
+24   positions     15 × u8
+39   attributes    54 × u8（52 项属性 + 左右脚 2 字节）
+93   transfer_value u32
+98   club_join_date u32
+106  match_sharpness u16
+110  condition       u16
+121  height_cm       u8
+122  decode extent

记录头之前：
-19   pindex
-15   uid
-11   uid copy
-6    home reputation
-4    current reputation
-2    world reputation
```

属性显示值换算：

```text
display = max(1, (raw + 2) / 5)   // 整数除法，raw 1–100 → 显示 1–20
```

### 6.4 `fm27-core` 模块

```text
fm27-core/src/
├─ container.rs          # header、zstd、trailer、section 读取
├─ fingerprint.rs        # 存档指纹、变更检测
├─ layouts/
│  ├─ mod.rs             # LayoutRegistry
│  ├─ fm27_27_0_0.rs     # FM27 布局常量
│  └─ fm26_fallback.rs   # 未变区域的 fallback
├─ gamedb/
│  ├─ names.rs           # 姓名池
│  ├─ players.rs         # marker/完整性扫描、记录解码
│  ├─ persons.rs         # 人员块：姓名、生日、国籍、性格、习惯
│  ├─ clubs.rs           # 俱乐部、球队列表、声望状态
│  ├─ contracts.rs       # 合同链、工资、到期、租借、条款
│  └─ suspensions.rs     # 停赛（后续）
├─ normalize.rs          # 原始值 → 显示值、日期、缺失值
├─ validate.rs           # 不变量、覆盖率、异常报告
├─ store.rs              # SQLite schema / insert / query
├─ export.rs             # CSV / JSON
└─ lib.rs
```

### 6.5 解析流程

1. 读取 header + trailer，建立 section 索引。
2. 只解压 `game_db`、`save_game_summary` 等需要的 section。
3. 解析姓名池，建立姓名 ID → 字符串索引。
4. 扫描球员记录：
   - marker 快速扫描
   - 完整性扫描补充无 marker 的记录
   - 校验 pindex/uid 唯一性
5. 对每条球员记录：
   - 解码 CA/PA、属性、位置、身价、身高、状态
   - 在记录窗口内扫描人员块，解码姓名、生日、国籍、性格、习惯
   - 在合同链窗口内解码合同
6. 建立俱乐部/球队索引，完成 team_id → club 映射。
7. 归一化后写入 SQLite。
8. 输出解析报告：版本、日期、记录数、覆盖率、警告。

### 6.6 性能目标

| 指标 | 目标 |
|---|---|
| 49 MB 存档解析 | < 3 秒（Rust，目标 < 2 秒） |
| `game_db` 解压 | < 500 ms |
| 46k 球员写入 SQLite | < 1 秒 |
| 球员列表查询 | < 100 ms |
| 单球员详情查询 | < 20 ms |
| 峰值内存 | < 500 MB |
| 冷启动到可操作 | < 3 秒（已缓存时） |

### 6.7 错误处理

- 不认识的 build/schema：降级读取，输出 `coverage`，不猜测缺失字段。
- 存档正在写入：检测文件大小/mtime 变化，提示重试或使用快照副本。
- 解压超过上限：拒绝解析并提示文件损坏/异常。
- 单条记录解码失败：跳过并计数，不中断整个解析；报告中列出失败数量。
- 俱乐部计数表绑定失败：MVP 使用记录扫描结果；正式版补 FM27 layout。

---

## 7. 数据层

### 7.1 SQLite 表

```sql
CREATE TABLE saves (
  id              INTEGER PRIMARY KEY,
  path            TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  mtime_ns        INTEGER NOT NULL,
  fingerprint     TEXT NOT NULL,
  game            TEXT NOT NULL,
  build           TEXT NOT NULL,
  game_date       TEXT,
  db_version      TEXT,
  parser_version  TEXT NOT NULL,
  parsed_at       TEXT NOT NULL
);

CREATE TABLE players (
  save_id         INTEGER NOT NULL,
  uid             INTEGER NOT NULL,
  unique_id       INTEGER,
  name            TEXT,
  first_name      TEXT,
  last_name       TEXT,
  common_name     TEXT,
  birth_date      TEXT,
  age             INTEGER,
  nation_id       INTEGER,
  club_uid        INTEGER,
  club_name       TEXT,
  ca              INTEGER,
  pa              INTEGER,
  pa_range_code   INTEGER,
  height_cm       INTEGER,
  left_foot       INTEGER,
  right_foot      INTEGER,
  raw_condition   INTEGER,
  raw_sharpness   INTEGER,
  transfer_value  INTEGER,
  value_state     TEXT,
  positions_json  TEXT,
  personality_json TEXT,
  traits_json     TEXT,
  attributes_json TEXT,
  -- 52 个属性列可按需展开，便于 SQL 筛选/排序
  PRIMARY KEY (save_id, uid)
);

CREATE TABLE contracts (
  save_id         INTEGER NOT NULL,
  player_uid      INTEGER NOT NULL,
  club_uid        INTEGER,
  club_name       TEXT,
  team_id         INTEGER,
  wage            INTEGER,
  start_date      TEXT,
  end_date        TEXT,
  squad_status    TEXT,
  contract_type   TEXT,
  on_loan         INTEGER,
  loan_parent_club_uid INTEGER,
  loan_start      TEXT,
  loan_end        TEXT,
  clauses_json    TEXT
);

CREATE TABLE clubs (
  save_id         INTEGER NOT NULL,
  uid             INTEGER NOT NULL,
  name            TEXT,
  short_name      TEXT,
  nation_id       INTEGER,
  reputation      INTEGER,
  last_league_position INTEGER,
  parent_club_uid INTEGER,
  PRIMARY KEY (save_id, uid)
);

CREATE TABLE snapshots (
  save_id         INTEGER NOT NULL,
  game_date       TEXT NOT NULL,
  player_uid      INTEGER NOT NULL,
  ca              INTEGER,
  pa              INTEGER,
  transfer_value  INTEGER,
  club_uid        INTEGER,
  wage            INTEGER,
  contract_end    TEXT,
  PRIMARY KEY (save_id, game_date, player_uid)
);
```

### 7.2 查询策略

- 前端不一次拉取 46k 行；使用**服务端分页 + 筛选 + 排序**。
- 每页 100–200 行，返回当前页完整字段。
- 常用筛选列建索引：`name`、`club_uid`、`nation_id`、`age`、`ca`、`pa`、`transfer_value`、`contract_end`。
- 属性筛选：46k 行规模下 SQLite 全表扫描也很快；如未来支持 50 万+ 球员，再对高频属性加索引。
- 排序/筛选字段必须走**白名单**，值使用参数绑定，避免 SQL 注入。
- 解析写入使用单事务 + prepared statement，保证速度与一致性。
- 启用 WAL 模式，提升读写并发体验。

### 7.3 缓存与更新

- 每个存档用 `fingerprint` 标识：文件大小 + mtime + header/trailer hash。
- 打开存档时先查 `saves`；指纹相同直接复用 SQLite。
- 指纹变化时提示“存档已更新，是否重新解析”。
- 保留最近 N 个存档缓存；提供“清理缓存”。
- 解析器版本变化时，标记旧缓存需要重建。

---

## 8. Tauri 集成

### 8.1 命令与事件

```rust
#[tauri::command]
fn open_save(path: String) -> Result<SaveSummary, String>;

#[tauri::command]
fn parse_save(app: AppHandle, path: String, force: bool) -> Result<ParseReport, String>;

#[tauri::command]
fn list_saves() -> Result<Vec<SaveSummary>, String>;

#[tauri::command]
fn query_players(query: PlayerQuery) -> Result<PlayerPage, String>;

#[tauri::command]
fn get_player(save_id: i64, uid: i64) -> Result<PlayerDetail, String>;

#[tauri::command]
fn export_players(query: PlayerQuery, format: String, path: String) -> Result<ExportReport, String>;

#[tauri::command]
fn get_filter_options(save_id: i64) -> Result<FilterOptions, String>;
```

进度事件：

```text
parse://progress  { stage, current, total, message }
parse://done      { save_id, players, clubs, contracts, elapsed_ms }
parse://error     { message, stage }
```

### 8.2 线程与数据库

- 解析是 CPU/IO 密集任务：放在 `spawn_blocking` 中，避免阻塞 UI 线程。
- SQLite 使用 `rusqlite` + `parking_lot::Mutex<Connection>`；桌面单用户足够。
- 解析写入使用一个事务；查询使用只读连接或同一连接串行化。
- 前端查询通过 Tauri command 异步调用；不把数据库路径暴露给 WebView。

### 8.3 存档访问与安全

- 使用 Tauri dialog 插件让用户选择 `.fm` 文件。
- 读取前复制到应用缓存目录做**快照副本**，解析副本，避免游戏正在写入导致读到半截文件。
- 快照文件解析完可删除；需要重解析时重新复制。
- 存档只读；不提供任何写入/编辑命令。
- Tauri capabilities 只开放必要插件：
  - `dialog`：选择文件/目录
  - `log`：本地日志
  - 自定义命令
- 不启用 `shell`、`http`、`fs` 任意路径访问。
- CSP 限制为本地资源；默认禁止外部网络请求。
- 不上传存档、球员数据或使用统计。

### 8.4 macOS 存档路径与系统集成

```text
存档目录：
~/Library/Application Support/Sports Interactive/Football Manager 27/games

应用数据目录：
~/Library/Application Support/com.fm27scout.app/
```

- 启动时扫描存档目录，列出最近存档；同时支持手动选择任意 `.fm` 文件。
- SQLite、日志、快照都放应用数据目录，不写游戏目录。
- 目标系统 macOS 14+；构建 Universal Binary（Apple Silicon + Intel）。
- 窗口使用 macOS overlay title bar / 原生菜单；快捷键 `Cmd+O` / `Cmd+E` / `Cmd+,`。
- 发布方式为 `.app` + `.dmg`，使用 Developer ID 签名并 notarize。
- 暂不做 Mac App Store 沙盒；如果以后上架，再补 security-scoped bookmarks。
- Windows/Linux 路径与打包流程暂不实现；解析核心保持平台无关。

---

## 9. 前端与 UI

### 9.1 整体布局

```text
┌──────────────────────────────────────────────────────────────┐
│ 工具栏：存档选择 / 搜索 / 筛选 / 导出 / 设置                  │
├──────────────┬───────────────────────────────┬───────────────┤
│ 筛选侧栏      │ 球员表格                       │ 球员详情       │
│              │                               │               │
│ 俱乐部        │ Name | Age | Club | Pos | CA  │ 属性分组       │
│ 国籍          │ ...                           │ 隐藏属性       │
│ 年龄          │                               │ 性格/合同      │
│ 位置          │                               │ 身价/状态      │
│ CA/PA         │                               │               │
│ 属性范围      │                               │               │
│ 合同          │                               │               │
│ 隐藏属性开关  │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
```

macOS 交互细节：

- 原生菜单：`File > Open Save…`（Cmd+O）、`File > Export…`（Cmd+E）、`Settings…`（Cmd+,）。
- 窗口使用 overlay title bar，保留交通灯按钮；侧栏可折叠。
- 表格默认紧凑行高，支持触控板横向/纵向滚动。
- 使用系统浅色/深色外观，尊重“减少动态效果”。

### 9.2 球员表格

- TanStack Table + Virtual，支持 46k 行流畅滚动。
- 默认列：
  - 姓名、年龄、俱乐部、国籍、位置、CA、PA、身价、工资、合同到期。
- 列预设：
  - 概览
  - 技术
  - 精神
  - 身体
  - 门将
  - 隐藏
  - 合同
- 支持列显示/隐藏、列宽、冻结前几列、紧凑/舒适行高。
- 多列排序；排序在后端执行。
- 行点击打开右侧详情；Cmd/Ctrl 多选用于对比。

### 9.3 筛选器

- 文本搜索：姓名、俱乐部、常用名。
- 俱乐部、国籍下拉（支持搜索）。
- 年龄区间。
- 位置选择：点击球场位置或选择位置组。
- CA/PA 区间；支持“PA 未知/随机”单独筛选。
- 属性规则：
  - 选择属性 + 最小/最大值
  - 可叠加多条规则
  - 规则以 chip 形式展示、可删除
- 合同：到期年份、是否租借、工资区间。
- 身价区间。
- 隐藏属性筛选需先打开隐藏属性开关。
- 筛选预设保存到本地。

### 9.4 球员详情

- 顶部：姓名、俱乐部、年龄、国籍、位置、CA/PA 徽章。
- 属性卡片：
  - 技术：传球、盘带、射门、传中、技术、停球等
  - 精神：视野、决断、预判、团队、工作投入、领导力等
  - 身体：速度、加速、耐力、力量、弹跳、平衡、敏捷等
  - 门将：手控球、反应、一对一、制空、指挥防守等
  - 隐藏：稳定、大赛、受伤倾向、肮脏、多面性
  - 性格：职业、雄心、忠诚、抗压、气质、争议、适应、体育精神
- 每个属性用 1–20 的条形/色块展示；可切换显示原始 1–100 值。
- 位置面板：15 个位置评分，天然位置高亮。
- 习惯动作列表。
- 合同卡片：俱乐部、工资、开始/到期、 squad status、租借信息。
- 身价、身高、左右脚、体质、比赛状态。
- 可选雷达图。

### 9.5 对比

- 最多 4 名球员。
- 属性并排显示，最优值高亮。
- 支持只看差异、只看隐藏属性。
- 可导出对比结果。

### 9.6 设置

- 隐藏属性总开关：
  - 默认关闭
  - 开启时显示提示：仅限单机使用，线上联赛可能被视为作弊
- 主题：浅色/深色/跟随系统。
- 语言：中文/英文（MVP 先中文）。
- 数值显示：1–20 / 原始 1–100。
- 工资显示：周/月/年（如果存档单位可确定；否则标注“存档单位”）。
- 缓存管理：清理、重建、查看解析报告。
- 关于/免责声明/第三方许可证。

### 9.7 可访问性

- 键盘导航：搜索、表格、详情、筛选。
- 焦点可见；支持 VoiceOver 基本朗读。
- 尊重减少动画设置。
- 颜色对比度满足 WCAG AA。

---

## 10. 目录结构

```text
fm27-scout/
├─ apps/
│  └─ desktop/                 # Tauri 应用
│     ├─ src/                  # React 前端
│     ├─ src-tauri/            # Tauri Rust 后端
│     └─ package.json
├─ crates/
│  ├─ fm27-core/               # 解析核心
│  │  ├─ src/
│  │  └─ tests/
│  └─ fm27-cli/                # 命令行工具
├─ shared/
│  ├─ schema.sql               # SQLite schema
│  └─ types/                   # 前后端共享类型（tauri-specta 生成）
├─ fixtures/                   # 测试存档（gitignore，不提交）
├─ docs/
│  ├─ parser-notes.md
│  ├─ fm27-layout.md
│  └─ validation.md
├─ scripts/
│  ├─ oracle_export.py         # Python 参考导出
│  └─ compare_outputs.py       # Rust vs Python 对比
└─ .github/workflows/
   ├─ ci.yml
   └─ release.yml
```

---

## 11. 里程碑（并行开发）

按 1 名有经验开发者、全职投入估算。CLI/数据层（Track A）与 UI（Track B）从第 1 周并行推进，通过共享类型和 mock 数据解耦。

| 周 | Track A：Rust / 数据 | Track B：Tauri / UI | 周末验收 |
|---|---|---|---|
| 第 1 周 | 容器、section 索引、球员记录扫描、属性解码 | Tauri 壳、React 表格、mock 数据、共享类型 | CLI 能输出前 1,000 名球员；UI 能滚动 mock 表格 |
| 第 2 周 | 人员块、姓名池、俱乐部/球队、合同；SQLite 写入 | 筛选器、详情页、隐藏属性开关、错误/空状态 | 打开真实存档 → 表格可操作；详情字段完整 |
| 第 3 周 | 合同/租借/条款完善；查询层与导出 | 对比、图表、筛选预设、列预设、设置 | 46,273 条记录与 oracle 对齐；核心筛选可用 |
| 第 4 周 | 性能优化、异常处理、解析报告、缓存失效 | 性能优化、快捷键、可访问性、视觉打磨 | 解析 < 3s；表格滚动流畅；无阻塞 |
| 第 5 周 | 回归测试、边界存档、文档 | macOS 打包、签名、notarization、DMG | 干净 Mac 安装可运行；无网络请求 |
| 第 6 周 | 缓冲/修 bug | 缓冲/修 bug | 发布候选版本 |

**总计：约 4–6 周全职可出可用版本；含缓冲按 6–8 周估算。**  
兼职开发按 1.5–2 倍时间估算。

### 各阶段验收标准

- **第 1 周**：Rust 能定位并解码球员记录；React 表格可展示 mock 数据；类型契约稳定。
- **第 2 周**：真实存档端到端可用；46,273 条记录数量正确；姓名/CA/PA/属性抽样一致。
- **第 3 周**：SQLite 查询支持俱乐部/位置/CA/PA/属性筛选；CSV/JSON 导出可用。
- **第 4 周**：解析 < 3 秒；46k 行滚动流畅；详情、对比、隐藏开关、主题、中文界面完成。
- **第 5 周**：macOS DMG 可在干净机器运行；签名/notarization 通过；无网络请求。
- **第 6 周**：回归通过，发布候选版本可交付。

---

## 12. 测试与验证

### 12.1 解析正确性

- **Python oracle 对比**：
  - 用已验证的 Python 实现导出全部 46,273 名球员的 JSON。
  - Rust 输出逐字段对比；允许的差异必须显式列出。
- **截图核对**：
  - 选 10–20 名不同位置/年龄的球员。
  - 对比游戏内 CA/PA、属性、隐藏属性、性格、合同、身价。
- **不变量**：
  - 球员 UID 不重复。
  - 属性在 1–20 显示范围；原始值 1–100。
  - 位置评分 1–20。
  - CA/PA 在合理范围；负 PA 作为范围代码处理。
  - 合同结束日期不早于开始日期。
  - team_id 能映射到俱乐部，或明确为自由球员。

### 12.2 单元测试

- 容器：header、trailer、frame 边界、截断文件。
- 布局：各偏移、属性顺序、脚部索引。
- 人员块：FM27 +1 偏移、姓名、生日、性格、关系。
- 合同：工资、日期、squad status、租借。
- 归一化：raw → display、PA 负值、缺失值。
- SQLite：插入、查询、分页、排序、筛选。

### 12.3 集成测试

- 47k 球员完整解析。
- 多次解析同一存档（缓存命中）。
- 存档更新后重新解析。
- 损坏/截断/空文件。
- 大数据库（如果用户提供）。
- 自定义数据库（当前存档就是自定义数据库，必须覆盖）。

### 12.4 前端测试

- Vitest + React Testing Library：筛选器、表格、详情、设置。
- Playwright：启动应用、打开存档、搜索、筛选、导出。
- 手动检查：macOS 14+（Apple Silicon + Intel）。

### 12.5 性能测试

- Criterion benchmark：容器解压、球员扫描、人员块解码、SQLite 写入。
- 前端：46k 行滚动 FPS、筛选响应时间。
- 内存：解析峰值、长时间运行内存。

### 12.6 安全测试

- 确认 release 构建无网络请求。
- Tauri capabilities 最小化。
- 动态 SQL 字段白名单。
- 不把存档内容写入日志。
- 不执行外部命令。

---

## 13. 打包与发布

### 13.1 构建目标

- macOS 14+
- Universal Binary（Apple Silicon + Intel）
- `.app` + `.dmg`
- Developer ID 签名 + notarization
- Windows/Linux 暂不构建、不发布

### 13.2 CI

GitHub Actions macOS job：

```text
macos-latest -> cargo test + pnpm test + tauri build + notarize
```

缓存 Rust 依赖和前端依赖；发布时上传 `.dmg`。

### 13.3 更新

- MVP 手动下载新版本。
- 后续接入 Tauri Updater：
  - 签名更新 manifest
  - 应用内检查更新
  - 用户确认后下载安装

### 13.4 版本号

- 应用版本：`0.1.0` → `1.0.0`
- 解析器版本单独记录在 `parser_version`，用于缓存失效。
- 每次 FM27 补丁导致布局变化时，提升 parser 版本。

---

## 14. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| Rust 解析器开发量被低估 | 延期 | 先只做球员/俱乐部/合同核心；Python oracle 对照；分阶段验收 |
| FM27 后续补丁改变布局 | 解析失败 | 按 build + schema 做 layout registry；未知版本降级并提示，不猜值 |
| 俱乐部 counted table 变化 | 俱乐部边界/球队映射不完整 | MVP 用记录扫描；正式版补 FM27 `ClubTableLayout` |
| 自定义数据库/编辑器数据 | 球员、年龄、球队与现实不符 | 全部以存档为准；不依赖外部现实数据 |
| 国家/赛事名称不在存档 | 只能显示 ID | 内置/用户提供 `nation_names.csv`；赛事名称后续支持 |
| 大存档/超大数据库 | 内存/时间问题 | 只解压需要的 section；设置解压上限；分页查询；缓存 |
| 游戏正在保存 | 读到半截文件 | 复制快照后解析；检测指纹变化；提示重试 |
| macOS 签名/notarization | 用户首次打开被拦截 | 提前配置 Developer ID、hardened runtime 和 notarization；文档说明 |
| WKWebView 性能/兼容性 | 46k 行表格卡顿或样式差异 | 虚拟滚动、分页查询、在 macOS 14+ 的 Intel/Apple Silicon 上测试 |
| 动态 SQL 注入 | 安全问题 | 字段白名单 + 参数绑定 |
| 隐藏属性伦理/线上公平性 | 争议 | 默认隐藏；开启提示；仅单机；不修改存档 |
| 法律/商标 | 风险 | 只读工具；不捆绑 SI/SEGA 数据/图片；免责声明；MIT 归属 |

---

## 15. 合规与边界

- 本工具**只读**，不修改存档，不注入游戏进程。
- 仅面向单机/个人分析；线上联赛、对战平台使用隐藏属性可能违反规则。
- 不联网、不上传存档或球员数据。
- 不内置 SI/SEGA 的受版权保护数据库、图片、Logo。
- 使用/参考的开源项目保留许可证和归属：
  - `fmsave`（MIT）：解析逻辑参考与验证 oracle
  - Tauri、React、TanStack、shadcn/ui 等各自许可证
- 应用内提供免责声明：非官方工具，与 Sports Interactive / SEGA 无关。

---

## 16. 下一步

按第 1 周并行计划开始：

1. **建立 monorepo 和共享类型**
   - `apps/desktop`（Tauri + React）
   - `crates/fm27-core`
   - `crates/fm27-cli`
   - `shared/schema.sql`
   - 用 `tauri-specta` 生成前后端共享 TypeScript 类型。
2. **Track A**：实现容器 + 球员记录扫描，先用当前存档输出前 1,000 名球员。
3. **Track B**：用 Python oracle 生成 mock JSON，搭 Tauri 壳、表格、详情页。
4. **第 2 周**：把真实 SQLite 数据接入 UI，完成“打开存档 → 表格 → 详情”闭环。
5. **第 3 周**：加筛选、对比、导出、隐藏属性开关。
6. **第 5 周**：macOS 打包、签名、notarization。

已确认的决策：

- 前端：**React + TypeScript**。
- 平台：**只做 macOS 14+**，Windows/Linux 暂缓。
- 隐藏属性：**默认关闭**，开启时提示。
- 开发方式：**CLI、数据层、UI 并行**。

下一步需要切换到执行代理后才能开始写代码。

---

## 附录 A：FM27 关键布局速查

```text
容器
  header size        26
  magic              02 01 66 6d 66 2e  ("\x02\x01fmf.")
  trailer pointer    u64 @ offset 9（trailer offset = 9 + value）
  frame              zstd，多 frame 连续存放
  section header     03 01 + reversed extension + schema u16 @ +6

球员记录（FM27，game_db schema 4000）
  marker             01 00 6c 07
  marker offset      +102
  CA                 u16 @ +0
  PA                 i16 @ +2
  team_id            u32 @ +16
  positions          15 × u8 @ +24
  attributes         54 × u8 @ +39
  transfer_value     u32 @ +93
  club_join_date     u32 @ +98
  match_sharpness    u16 @ +106
  condition          u16 @ +110
  height_cm          u8  @ +121
  decode extent      122
  pindex             -19
  uid                -15
  uid copy           -11

人员块（FM27 修正）
  window start       record + 100
  personality offset 22（FM26 为 21）
  zero region        (15, 6)（FM26 为 (14, 7)）

俱乐部
  anchor             ff ff ff ff
  record layout      与 FM26 26.3.2 基本一致
  counted table      FM27 framing 有变化；MVP 可绕过
```

## 附录 B：参考

- fmsave（MIT，FM26 存档解析器）：<https://github.com/rhiever/fmsave>
- FM27 schema 变化讨论：<https://github.com/rhiever/fmsave/issues/31>
- MacScout26（产品形态参考，闭源）：<https://github.com/Einzigart/MacScout26>
- Tauri：<https://tauri.app/>
- TanStack Table：<https://tanstack.com/table>
- rusqlite：<https://github.com/rusqlite/rusqlite>
- zstd crate：<https://github.com/gyscos/zstd-rs>

---

**文档结束。**
