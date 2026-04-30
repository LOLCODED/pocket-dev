pub mod ai;
pub mod commands;
pub mod error;
pub mod fs_safety;
pub mod paths;
pub mod secrets;
pub mod settings;
pub mod state;

use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::project::set_project_root,
            commands::project::current_project,
            commands::project::list_recent_projects,
            commands::project::close_project,
            commands::fs::list_dir,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::create_file,
            commands::fs::create_dir,
            commands::fs::delete_path,
            commands::fs::rename_path,
            commands::settings::get_settings,
            commands::settings::set_settings,
            commands::settings::set_api_key,
            commands::settings::clear_api_key,
            commands::settings::has_api_key,
            commands::chat::chat_send,
            commands::chat::chat_cancel,
            commands::postgres::pg_connect,
            commands::postgres::pg_disconnect,
            commands::postgres::pg_status,
            commands::postgres::pg_reconnect_saved,
            commands::postgres::pg_list_tables,
            commands::postgres::pg_run_sql,
            commands::postgres::pg_fetch_table_rows,
            commands::snapshot::create_snapshot,
            commands::http::send_request,
            commands::http::list_saved_endpoints,
            commands::http::save_endpoint,
            commands::http::delete_endpoint,
            commands::conversations::list_conversations,
            commands::conversations::get_conversation,
            commands::conversations::save_conversation,
            commands::conversations::delete_conversation,
            commands::terminal::term_open,
            commands::terminal::term_write,
            commands::terminal::term_resize,
            commands::terminal::term_close,
            commands::terminal::term_run_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
