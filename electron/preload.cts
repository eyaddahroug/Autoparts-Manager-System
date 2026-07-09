import { contextBridge, ipcRenderer } from 'electron';

export interface DbFilter {
  column: string;
  value: unknown;
  op: string;
}

export interface DbQueryOpts {
  order?: { column: string; ascending: boolean };
  limit?: number;
  columns?: string;
}

contextBridge.exposeInMainWorld('localDB', {
  all: (table: string, filters: DbFilter[] = [], opts: DbQueryOpts = {}) =>
    ipcRenderer.invoke('db:all', table, filters, opts),
  get: (table: string, filters: DbFilter[] = []) =>
    ipcRenderer.invoke('db:get', table, filters),
  insert: (table: string, data: Record<string, unknown> | Record<string, unknown>[]) =>
    ipcRenderer.invoke('db:insert', table, data),
  update: (table: string, data: Record<string, unknown>, filters: DbFilter[] = []) =>
    ipcRenderer.invoke('db:update', table, data, filters),
  delete: (table: string, filters: DbFilter[] = []) =>
    ipcRenderer.invoke('db:delete', table, filters),
  genId: () => ipcRenderer.invoke('db:genId'),
});
