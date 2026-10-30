use std::path::{Path, PathBuf};
use std::sync::Mutex;

use fm27_core::export::write_export;
use fm27_core::store::{
    AnalysisOverview, FilterOptions, PlayerPage, PlayerQuery, SaveRecord, SnapshotPoint,
    SquadAnalysis, Store,
};
use fm27_core::{
    ParseReport, Player, SaveSummary, inspect_save, parse_save_with_progress, parser_version,
};
use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State};

struct AppState {
    store: std::sync::Arc<Mutex<Store>>,
    data_dir: std::path::PathBuf,
}

/// File-open events can arrive before the webview has registered its listener, and on
/// a cold launch they can even arrive before `setup`. Keep one path in a process-global
/// slot until the frontend asks for it.
static PENDING_OPEN: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Serialize)]
struct OpenSaveResult {
    save_id: i64,
    cached: bool,
    summary: SaveSummary,
    report: Option<ParseReport>,
}

#[derive(Debug, Serialize)]
struct AppInfo {
    version: String,
    data_dir: String,
    nation_names: usize,
    competition_names: usize,
}

fn error_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn append_log(app: &AppHandle, line: &str) {
    if let Ok(directory) = app.path().app_data_dir() {
        let logs = directory.join("logs");
        if std::fs::create_dir_all(&logs).is_ok() {
            use std::io::Write;
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(logs.join("open-events.log"))
            {
                let _ = writeln!(file, "{line}");
            }
        }
    }
}

/// Copy a save into the app cache before parsing so a game that is still writing
/// cannot be read half-way through. The snapshot is removed after parsing.
fn create_snapshot(data_dir: &Path, source: &Path) -> Result<PathBuf, String> {
    let before = std::fs::metadata(source).map_err(error_string)?;
    let snapshots = data_dir.join("snapshots");
    std::fs::create_dir_all(&snapshots).map_err(error_string)?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);
    let name = source
        .file_stem()
        .map(|value| value.to_string_lossy().replace(['/', '\\'], "_"))
        .unwrap_or_else(|| "save".to_owned());
    let destination = snapshots.join(format!("{name}-{}-{stamp}.fm", std::process::id()));
    std::fs::copy(source, &destination).map_err(|error| {
        format!(
            "could not copy the save to the local snapshot cache: {error}. \
             If the game is saving, wait for it to finish and try again."
        )
    })?;
    let after = std::fs::metadata(source).map_err(error_string)?;
    if before.len() != after.len() || before.modified().ok() != after.modified().ok() {
        let _ = std::fs::remove_file(&destination);
        return Err(
            "the save changed while it was being copied. Wait for the game to finish saving and try again."
                .to_owned(),
        );
    }
    Ok(destination)
}

#[tauri::command]
fn list_saves(state: State<'_, AppState>) -> Result<Vec<SaveRecord>, String> {
    let store = state.store.lock().map_err(error_string)?;
    store.list_saves().map_err(error_string)
}

#[tauri::command]
async fn open_save(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    force: bool,
) -> Result<OpenSaveResult, String> {
    let inspected = inspect_save(&path).map_err(error_string)?;

    if !force {
        let store = state.store.lock().map_err(error_string)?;
        if let Some(save_id) = store
            .find_cached(&inspected.fingerprint, parser_version())
            .map_err(error_string)?
        {
            append_log(&app, &format!("cache hit save_id={save_id}"));
            drop(store);
            let _ = app.emit("parse://cached", &inspected);
            return Ok(OpenSaveResult {
                save_id,
                cached: true,
                summary: inspected,
                report: None,
            });
        }
    }

    let progress_app = app.clone();
    let _ = app.emit(
        "parse://progress",
        fm27_core::ParseProgress {
            stage: "snapshot".to_owned(),
            current: 0,
            total: 0,
            message: "正在创建只读快照".to_owned(),
        },
    );
    let snapshot = create_snapshot(&state.data_dir, Path::new(&path))?;
    let parse_path = snapshot.clone();
    let parse_result = tauri::async_runtime::spawn_blocking(move || {
        parse_save_with_progress(&parse_path, |progress| {
            let _ = progress_app.emit("parse://progress", &progress);
        })
    })
    .await
    .map_err(error_string)?;
    let _ = std::fs::remove_file(&snapshot);
    let mut parsed = parse_result.map_err(error_string)?;
    if parsed.summary.fingerprint != inspected.fingerprint {
        return Err(
            "the save changed while it was being opened. Wait for the game to finish saving and try again."
                .to_owned(),
        );
    }
    parsed.summary.path = path.clone();
    parsed.summary.file_name = Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    // The snapshot has its own mtime. Cache lookup must use the original save's
    // fingerprint, while the bytes (and therefore the digest) are identical.
    parsed.summary.file_size = inspected.file_size;
    parsed.summary.mtime_ns = inspected.mtime_ns;
    parsed.summary.fingerprint = inspected.fingerprint.clone();
    parsed.report.save = parsed.summary.clone();

    let mut store = state.store.lock().map_err(error_string)?;
    if force
        && let Some(existing) = store
            .find_cached(&parsed.summary.fingerprint, parser_version())
            .map_err(error_string)?
    {
        store.delete_save(existing).map_err(error_string)?;
    }
    let save_id = store.insert_parsed(&parsed).map_err(error_string)?;
    drop(store);

    let _ = app.emit("parse://done", &parsed.report);
    Ok(OpenSaveResult {
        save_id,
        cached: false,
        summary: parsed.summary,
        report: Some(parsed.report),
    })
}

#[tauri::command]
fn query_players(state: State<'_, AppState>, query: PlayerQuery) -> Result<PlayerPage, String> {
    let store = state.store.lock().map_err(error_string)?;
    store.query_players(&query).map_err(error_string)
}

#[tauri::command]
fn get_player(
    state: State<'_, AppState>,
    save_id: i64,
    uid: u32,
    include_hidden: bool,
) -> Result<Option<Player>, String> {
    let store = state.store.lock().map_err(error_string)?;
    store
        .get_player(save_id, uid, include_hidden)
        .map_err(error_string)
}

#[tauri::command]
fn player_roles(
    state: State<'_, AppState>,
    save_id: i64,
    uid: u32,
) -> Result<Vec<fm27_core::model::RoleScore>, String> {
    let store = state.store.lock().map_err(error_string)?;
    let player = store
        .get_player(save_id, uid, true)
        .map_err(error_string)?
        .ok_or_else(|| "player not found".to_owned())?;
    Ok(fm27_core::roles::score_roles(
        &player.attributes,
        &player.positions,
    ))
}

#[tauri::command]
fn growth_history(
    state: State<'_, AppState>,
    save_id: i64,
    uid: u32,
) -> Result<Vec<SnapshotPoint>, String> {
    let store = state.store.lock().map_err(error_string)?;
    store.growth_history(save_id, uid).map_err(error_string)
}

#[tauri::command]
fn analysis_overview(state: State<'_, AppState>, save_id: i64) -> Result<AnalysisOverview, String> {
    let store = state.store.lock().map_err(error_string)?;
    store.analysis_overview(save_id).map_err(error_string)
}

#[tauri::command]
fn squad_analysis(
    state: State<'_, AppState>,
    save_id: i64,
    club_uid: u32,
) -> Result<SquadAnalysis, String> {
    let store = state.store.lock().map_err(error_string)?;
    store
        .squad_analysis(save_id, club_uid)
        .map_err(error_string)
}

#[tauri::command]
fn get_filter_options(
    state: State<'_, AppState>,
    save_id: i64,
    query: Option<PlayerQuery>,
) -> Result<FilterOptions, String> {
    let store = state.store.lock().map_err(error_string)?;
    store
        .filter_options_with_query(save_id, query.as_ref())
        .map_err(error_string)
}

#[tauri::command]
fn delete_save(state: State<'_, AppState>, save_id: i64) -> Result<(), String> {
    let mut store = state.store.lock().map_err(error_string)?;
    store.delete_save(save_id).map_err(error_string)
}

#[tauri::command]
fn export_players(
    state: State<'_, AppState>,
    query: PlayerQuery,
    format: String,
    path: String,
) -> Result<fm27_core::export::ExportReport, String> {
    let store = state.store.lock().map_err(error_string)?;
    let rows = store.query_all(&query).map_err(error_string)?;
    write_export(std::path::Path::new(&path), &format, &rows).map_err(error_string)
}

#[tauri::command]
fn take_pending_open(app: AppHandle) -> Option<String> {
    let value = PENDING_OPEN
        .lock()
        .ok()
        .and_then(|mut pending| pending.take());
    append_log(&app, &format!("take_pending_open -> {value:?}"));
    value
}

#[tauri::command]
fn log_message(app: AppHandle, message: String) {
    append_log(&app, &format!("frontend: {message}"));
}

#[tauri::command]
fn app_info(state: State<'_, AppState>) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_owned(),
        data_dir: state.data_dir.display().to_string(),
        nation_names: fm27_core::nations::name_count(),
        competition_names: fm27_core::reference::name_count(),
    }
}

fn install_menu(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();
    let open = MenuItem::with_id(handle, "open", "打开存档…", true, Some("CmdOrCtrl+O"))?;
    let export = MenuItem::with_id(handle, "export", "导出…", true, Some("CmdOrCtrl+E"))?;
    let close = PredefinedMenuItem::close_window(handle, Some("关闭窗口"))?;
    let settings = MenuItem::with_id(handle, "settings", "设置…", true, Some("CmdOrCtrl+,"))?;
    let sidebar = MenuItem::with_id(
        handle,
        "sidebar",
        "显示/隐藏筛选栏",
        true,
        Some("CmdOrCtrl+\\"),
    )?;
    let inspector = MenuItem::with_id(
        handle,
        "inspector",
        "显示/隐藏球员档案",
        true,
        Some("CmdOrCtrl+Shift+I"),
    )?;
    let hidden = MenuItem::with_id(
        handle,
        "hidden",
        "开关隐藏属性",
        true,
        Some("CmdOrCtrl+Shift+H"),
    )?;
    let compare = MenuItem::with_id(
        handle,
        "compare",
        "球员对比",
        true,
        Some("CmdOrCtrl+Shift+C"),
    )?;
    let analysis = MenuItem::with_id(
        handle,
        "analysis",
        "分析中心",
        true,
        Some("CmdOrCtrl+Shift+A"),
    )?;
    let undo = PredefinedMenuItem::undo(handle, Some("撤销"))?;
    let redo = PredefinedMenuItem::redo(handle, Some("重做"))?;
    let cut = PredefinedMenuItem::cut(handle, Some("剪切"))?;
    let copy = PredefinedMenuItem::copy(handle, Some("复制"))?;
    let paste = PredefinedMenuItem::paste(handle, Some("粘贴"))?;
    let select_all = PredefinedMenuItem::select_all(handle, Some("全选"))?;
    let about = PredefinedMenuItem::about(handle, Some("关于 FM27 Scout"), None)?;
    let quit = PredefinedMenuItem::quit(handle, Some("退出 FM27 Scout"))?;
    let helper = MenuItem::with_id(
        handle,
        "help",
        "帮助与快捷键",
        true,
        Some("CmdOrCtrl+Shift+/"),
    )?;
    let sep1 = PredefinedMenuItem::separator(handle)?;
    let sep2 = PredefinedMenuItem::separator(handle)?;
    let sep3 = PredefinedMenuItem::separator(handle)?;
    let sep4 = PredefinedMenuItem::separator(handle)?;
    let sep5 = PredefinedMenuItem::separator(handle)?;

    let app_menu = Submenu::with_items(
        handle,
        "FM27 Scout",
        true,
        &[&about, &sep1, &settings, &sep2, &quit],
    )?;
    let file_menu = Submenu::with_items(handle, "文件", true, &[&open, &export, &sep3, &close])?;
    let edit_menu = Submenu::with_items(
        handle,
        "编辑",
        true,
        &[&undo, &redo, &sep4, &cut, &copy, &paste, &select_all],
    )?;
    let view_menu = Submenu::with_items(
        handle,
        "视图",
        true,
        &[&sidebar, &inspector, &sep5, &hidden, &compare, &analysis],
    )?;
    let help_menu = Submenu::with_items(handle, "帮助", true, &[&helper])?;
    let menu = Menu::with_items(
        handle,
        &[&app_menu, &file_menu, &edit_menu, &view_menu, &help_menu],
    )?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let action = event.id().as_ref();
        if !action.is_empty() {
            let _ = app.emit("menu://action", action);
        }
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            install_menu(app)?;
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let snapshots = data_dir.join("snapshots");
            std::fs::create_dir_all(&snapshots)?;
            if let Ok(entries) = std::fs::read_dir(&snapshots) {
                for entry in entries.flatten() {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
            let store = Store::open(data_dir.join("fm27scout.db"))?;
            app.manage(AppState {
                store: std::sync::Arc::new(Mutex::new(store)),
                data_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_saves,
            open_save,
            query_players,
            get_player,
            player_roles,
            growth_history,
            analysis_overview,
            squad_analysis,
            get_filter_options,
            delete_save,
            export_players,
            app_info,
            take_pending_open,
            log_message
        ])
        .build(tauri::generate_context!())
        .expect("error while building FM27 Scout")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                append_log(app, &format!("opened urls={urls:?}"));
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        if let Ok(mut pending) = PENDING_OPEN.lock() {
                            *pending = Some(path.display().to_string());
                            append_log(app, &format!("pending set -> {}", path.display()));
                        }
                        let _ = app.emit("open://file", path.display().to_string());
                    }
                }
            }
        });
}
