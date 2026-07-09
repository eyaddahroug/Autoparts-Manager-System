/// <reference types="vite/client" />

interface DbFilter {
  column: string;
  value: unknown;
  op: string;
}

interface DbQueryOpts {
  order?: { column: string; ascending: boolean };
  limit?: number;
  columns?: string;
}

interface Window {
  localDB: {
    all: (table: string, filters?: DbFilter[], opts?: DbQueryOpts) => Promise<unknown[]>;
    get: (table: string, filters?: DbFilter[]) => Promise<unknown>;
    insert: (table: string, data: Record<string, unknown> | Record<string, unknown>[]) => Promise<unknown>;
    update: (table: string, data: Record<string, unknown>, filters?: DbFilter[]) => Promise<unknown[]>;
    delete: (table: string, filters?: DbFilter[]) => Promise<number>;
    genId: () => Promise<string>;
  };
}
