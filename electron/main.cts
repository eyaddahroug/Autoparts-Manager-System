import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface DBSchema {
  parts: DBRecord[];
  invoices: DBRecord[];
  invoice_items: DBRecord[];
  payments: DBRecord[];
  settings: DBRecord[];
}

type DBRecord = Record<string, unknown>;

// Minimal synchronous JSON-file store, API-compatible with the subset of
// lowdb's LowSync we used (data / read() / write()). lowdb itself is a
// pure-ESM package and can never be require()'d from a CommonJS (.cjs)
// Electron main process, so we avoid it entirely instead of fighting the
// module system.
class JsonFileStore<T> {
  data: T;
  constructor(private filePath: string, private defaultData: T) {
    this.data = defaultData;
  }
  read() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = raw.trim() ? JSON.parse(raw) : this.defaultData;
      } else {
        this.data = this.defaultData;
      }
    } catch {
      this.data = this.defaultData;
    }
  }
  write() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}

let mainWindow: BrowserWindow | null = null;
let db: JsonFileStore<DBSchema> | null = null;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'autoparts-db.json');
  db = new JsonFileStore<DBSchema>(dbPath, {
    parts: [],
    invoices: [],
    invoice_items: [],
    payments: [],
    settings: [{ id: 1, financial_password: null, updated_at: new Date().toISOString() }],
  });
  db.read();
  // Ensure all collections exist
  if (!db.data.parts) db.data.parts = [];
  if (!db.data.invoices) db.data.invoices = [];
  if (!db.data.invoice_items) db.data.invoice_items = [];
  if (!db.data.payments) db.data.payments = [];
  // Migrate legacy object-shaped settings (from an earlier buggy version) into array form
  if (!db.data.settings || !Array.isArray(db.data.settings)) {
    const legacy = db.data.settings as unknown as DBRecord | undefined;
    db.data.settings = [
      legacy && typeof legacy === 'object'
        ? { id: 1, financial_password: legacy.financial_password ?? null, updated_at: legacy.updated_at ?? new Date().toISOString() }
        : { id: 1, financial_password: null, updated_at: new Date().toISOString() },
    ];
  }
  db.write();
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function getCollection(table: string): DBRecord[] {
  if (!db || !db.data) throw new Error('DB not initialized');
  const data = db.data as unknown as Record<string, unknown>;
  const coll = data[table];
  if (!Array.isArray(coll)) throw new Error(`Table ${table} not found`);
  return coll as DBRecord[];
}

function matches(record: DBRecord, filters: { column: string; value: unknown; op: string }[]): boolean {
  for (const f of filters) {
    const val = record[f.column];
    switch (f.op) {
      case '=': if (val !== f.value) return false; break;
      case '!=': if (val === f.value) return false; break;
      case '>': if (!(Number(val) > Number(f.value))) return false; break;
      case '<': if (!(Number(val) < Number(f.value))) return false; break;
      case '>=': if (!(Number(val) >= Number(f.value))) return false; break;
      case '<=': if (!(Number(val) <= Number(f.value))) return false; break;
      case 'LIKE': {
        const pattern = String(f.value).replace(/%/g, '.*').replace(/_/g, '.');
        if (!new RegExp(pattern, 'i').test(String(val))) return false;
        break;
      }
    }
  }
  return true;
}

function convertValue(v: unknown): unknown {
  if (v === true) return 1;
  if (v === false) return 0;
  return v;
}

function setupIpc() {
  // SELECT: returns array of records
  ipcMain.handle('db:all', (_event, table: string, filters: { column: string; value: unknown; op: string }[] = [], opts: { order?: { column: string; ascending: boolean }; limit?: number; columns?: string } = {}) => {
    const coll = getCollection(table);
    let results = coll.filter(r => matches(r, filters));
    if (opts.order) {
      results = results.sort((a, b) => {
        const av = a[opts.order!.column];
        const bv = b[opts.order!.column];
        if (av === bv) return 0;
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return opts.order!.ascending ? cmp : -cmp;
      });
    }
    if (opts.limit !== undefined && opts.limit !== null) {
      results = results.slice(0, opts.limit);
    }
    return results;
  });

  // SELECT single: returns first matching record or null
  ipcMain.handle('db:get', (_event, table: string, filters: { column: string; value: unknown; op: string }[] = []) => {
    const coll = getCollection(table);
    return coll.find(r => matches(r, filters)) || null;
  });

  // INSERT: takes record(s), returns them with generated ids
  ipcMain.handle('db:insert', (_event, table: string, data: DBRecord | DBRecord[]) => {
    if (!db || !db.data) throw new Error('DB not initialized');
    const coll = getCollection(table);
    const records = Array.isArray(data) ? data : [data];
    const results: DBRecord[] = [];
    const now = new Date().toISOString();
    for (const record of records) {
      const id = (record.id as string) || genId();
      // created_at/updated_at used to be filled in automatically by the old
      // Supabase DB defaults (DEFAULT now()). Replicate that here so any
      // record inserted without an explicit timestamp still gets one —
      // otherwise date-based code elsewhere (reports, "today" filters, etc.)
      // breaks or crashes on the missing value.
      const newRecord: DBRecord = { created_at: now, updated_at: now, ...record, id };
      for (const key of Object.keys(newRecord)) {
        newRecord[key] = convertValue(newRecord[key]);
      }
      coll.push(newRecord);
      results.push(newRecord);
    }
    db.write();
    return Array.isArray(data) ? results : results[0];
  });

  // UPDATE: takes data + filters, returns updated records
  ipcMain.handle('db:update', (_event, table: string, data: DBRecord, filters: { column: string; value: unknown; op: string }[] = []) => {
    if (!db || !db.data) throw new Error('DB not initialized');
    const coll = getCollection(table);
    const updated: DBRecord[] = [];
    const patch: DBRecord = 'updated_at' in data ? data : { ...data, updated_at: new Date().toISOString() };
    for (const record of coll) {
      if (matches(record, filters)) {
        for (const key of Object.keys(patch)) {
          record[key] = convertValue(patch[key]);
        }
        updated.push(record);
      }
    }
    db.write();
    return updated;
  });

  // DELETE: takes filters, returns count
  ipcMain.handle('db:delete', (_event, table: string, filters: { column: string; value: unknown; op: string }[] = []) => {
    if (!db || !db.data) throw new Error('DB not initialized');
    const coll = getCollection(table);
    const remaining = coll.filter(r => !matches(r, filters));
    const deletedCount = coll.length - remaining.length;
    // Replace collection contents in place
    coll.length = 0;
    coll.push(...remaining);
    db.write();
    return deletedCount;
  });

  // Generate ID
  ipcMain.handle('db:genId', () => genId());
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    title: 'إدارة قطع غيار السيارات',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  setupIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) { db.write(); db = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (db) { db.write(); db = null; }
});
