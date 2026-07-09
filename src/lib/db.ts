// Local JSON database adapter (lowdb) that mimics Supabase query builder API
// Uses Electron IPC to communicate with the main process which handles lowdb

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DBResult = { data: any; error: { message: string } | null };

type Filter = { column: string; value: unknown; op: string };
type OrderOpts = { ascending: boolean; column: string };

class QueryBuilder {
  private table: string;
  private filters: Filter[] = [];
  private orderOpts: OrderOpts | null = null;
  private limitVal: number | null = null;
  private insertData: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updateData: Record<string, unknown> | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private deleteMode = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns: string = '*'): QueryBuilder {
    return this;
  }

  eq(column: string, value: unknown): QueryBuilder {
    if (value === true) value = 1;
    else if (value === false) value = 0;
    this.filters.push({ column, value, op: '=' });
    return this;
  }

  neq(column: string, value: unknown): QueryBuilder {
    if (value === true) value = 1;
    else if (value === false) value = 0;
    this.filters.push({ column, value, op: '!=' });
    return this;
  }

  gt(column: string, value: unknown): QueryBuilder {
    this.filters.push({ column, value, op: '>' });
    return this;
  }

  lt(column: string, value: unknown): QueryBuilder {
    this.filters.push({ column, value, op: '<' });
    return this;
  }

  lte(column: string, value: unknown): QueryBuilder {
    this.filters.push({ column, value, op: '<=' });
    return this;
  }

  gte(column: string, value: unknown): QueryBuilder {
    this.filters.push({ column, value, op: '>=' });
    return this;
  }

  ilike(column: string, value: string): QueryBuilder {
    this.filters.push({ column, value, op: 'LIKE' });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): QueryBuilder {
    this.orderOpts = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  limit(n: number): QueryBuilder {
    this.limitVal = n;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): QueryBuilder {
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): QueryBuilder {
    this.updateData = data;
    return this;
  }

  delete(): QueryBuilder {
    this.deleteMode = true;
    return this;
  }

  single(): QueryBuilder {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): QueryBuilder {
    this.isMaybeSingle = true;
    return this;
  }

  private async execute(): Promise<DBResult> {
    try {
      if (this.insertData) {
        const result = await window.localDB.insert(this.table, this.insertData);
        if (this.isSingle || this.isMaybeSingle) {
          return { data: result, error: null };
        }
        return { data: result, error: null };
      } else if (this.updateData) {
        const result = await window.localDB.update(this.table, this.updateData, this.filters);
        return { data: result, error: null };
      } else if (this.deleteMode) {
        await window.localDB.delete(this.table, this.filters);
        return { data: null, error: null };
      } else {
        const opts: { order?: OrderOpts; limit?: number } = {};
        if (this.orderOpts) opts.order = this.orderOpts;
        if (this.limitVal !== null) opts.limit = this.limitVal;
        const rows = await window.localDB.all(this.table, this.filters, opts);
        if (this.isSingle) {
          if (!rows || (rows as unknown[]).length === 0) {
            return { data: null, error: { message: 'No rows found' } };
          }
          return { data: (rows as unknown[])[0], error: null };
        }
        if (this.isMaybeSingle) {
          if (!rows || (rows as unknown[]).length === 0) return { data: null, error: null };
          return { data: (rows as unknown[])[0], error: null };
        }
        return { data: rows, error: null };
      }
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  }

  // Make QueryBuilder thenable so `await` works directly
  then(onFulfilled: (value: DBResult) => unknown, onRejected?: (error: unknown) => unknown): Promise<DBResult> {
    return this.execute().then(onFulfilled, onRejected) as Promise<DBResult>;
  }
}

export const db = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  },
};

export async function genId() {
  return window.localDB.genId();
}
