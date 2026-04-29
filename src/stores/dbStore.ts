import { create } from "zustand";
import {
  pgService,
  type ColumnInfo,
  type ConnectionStatus,
  type TableInfo,
} from "../lib/services/postgres";

const PAGE_SIZE = 50;

type DbStore = {
  status: ConnectionStatus;
  tables: TableInfo[];
  selectedTable: TableInfo | null;
  page: { rows: unknown[][]; columns: ColumnInfo[]; total: number; offset: number };
  loading: boolean;

  hydrate: () => Promise<void>;
  connect: (url: string, save: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshTables: () => Promise<void>;
  selectTable: (t: TableInfo) => Promise<void>;
  setPageOffset: (offset: number) => Promise<void>;
};

const EMPTY_PAGE = { rows: [], columns: [], total: 0, offset: 0 };

export const useDbStore = create<DbStore>((set, get) => ({
  status: { connected: false, host_summary: null },
  tables: [],
  selectedTable: null,
  page: EMPTY_PAGE,
  loading: false,

  hydrate: async () => {
    const reconnected = await pgService.reconnectSaved().catch(() => false);
    const status = await pgService.status();
    set({ status });
    if (reconnected || status.connected) {
      await get().refreshTables();
    }
  },

  connect: async (url, save) => {
    set({ loading: true });
    try {
      const status = await pgService.connect(url, save);
      set({ status });
      await get().refreshTables();
    } finally {
      set({ loading: false });
    }
  },

  disconnect: async () => {
    await pgService.disconnect();
    set({
      status: { connected: false, host_summary: null },
      tables: [],
      selectedTable: null,
      page: EMPTY_PAGE,
    });
  },

  refreshTables: async () => {
    const tables = await pgService.listTables();
    set({ tables });
  },

  selectTable: async (t) => {
    set({ selectedTable: t, page: EMPTY_PAGE, loading: true });
    try {
      const result = await pgService.fetchTableRows(t.schema, t.name, PAGE_SIZE, 0);
      set({
        page: { rows: result.rows, columns: result.columns, total: result.total, offset: 0 },
      });
    } finally {
      set({ loading: false });
    }
  },

  setPageOffset: async (offset) => {
    const t = get().selectedTable;
    if (!t) return;
    set({ loading: true });
    try {
      const result = await pgService.fetchTableRows(t.schema, t.name, PAGE_SIZE, offset);
      set({
        page: { rows: result.rows, columns: result.columns, total: result.total, offset },
      });
    } finally {
      set({ loading: false });
    }
  },
}));

export const PAGE_SIZE_CONST = PAGE_SIZE;
