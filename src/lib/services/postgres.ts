import { invoke } from "@tauri-apps/api/core";

export interface ColumnInfo {
  name: string;
  type_name: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: unknown[][];
  rows_affected: number;
  took_ms: number;
}

export interface TableInfo {
  schema: string;
  name: string;
}

export interface PageResult {
  columns: ColumnInfo[];
  rows: unknown[][];
  total: number;
}

export interface ConnectionStatus {
  connected: boolean;
  host_summary: string | null;
}

export const pgService = {
  connect: (url: string, save: boolean) =>
    invoke<ConnectionStatus>("pg_connect", { url, save }),
  disconnect: () => invoke<void>("pg_disconnect"),
  status: () => invoke<ConnectionStatus>("pg_status"),
  reconnectSaved: () => invoke<boolean>("pg_reconnect_saved"),
  listTables: () => invoke<TableInfo[]>("pg_list_tables"),
  runSql: (query: string) => invoke<QueryResult>("pg_run_sql", { query }),
  fetchTableRows: (schema: string, table: string, limit: number, offset: number) =>
    invoke<PageResult>("pg_fetch_table_rows", { schema, table, limit, offset }),
};
