import { useState, useEffect, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Part, InvoiceWithItems, Payment, InvoiceItem } from './lib/types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PartsManager from './components/PartsManager';
import InvoiceCreator from './components/InvoiceCreator';
import InvoicesList from './components/InvoicesList';
import DeepSearch from './components/DeepSearch';
import MonthlyReport from './components/MonthlyReport';
import LowStockAlerts from './components/LowStockAlerts';
import SettingsModal from './components/SettingsModal';

export type View = 'dashboard' | 'parts' | 'create-invoice' | 'invoices' | 'search' | 'monthly' | 'alerts';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [parts, setParts] = useState<Part[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const fetchParts = useCallback(async () => {
    const { data, error } = await supabase.from('parts').select('*').order('code');
    if (error) { console.error(error); return; }
    setParts(data || []);
  }, []);

  const fetchInvoices = useCallback(async () => {
    const { data: invs, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    const itemMap: Record<string, NonNullable<typeof items>> = {};
    (items || []).forEach((item: InvoiceItem) => {
      if (!itemMap[item.invoice_id]) itemMap[item.invoice_id] = [];
      itemMap[item.invoice_id].push(item);
    });

    const paymentMap: Record<string, Payment[]> = {};
    (payments || []).forEach((p: Payment) => {
      if (!paymentMap[p.invoice_id]) paymentMap[p.invoice_id] = [];
      paymentMap[p.invoice_id].push(p);
    });

    const withItems: InvoiceWithItems[] = (invs || []).map((inv: InvoiceWithItems) => ({
      ...inv,
      items: itemMap[inv.id] || [],
      payments: paymentMap[inv.id] || [],
    }));
    setInvoices(withItems);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchParts(), fetchInvoices()]);
  }, [fetchParts, fetchInvoices]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    })();
  }, [refreshAll]);

  const lowStockCount = parts.filter(p => p.quantity <= p.min_quantity).length;

  return (
    <div className="min-h-screen flex bg-slate-950">
      <Sidebar view={view} setView={setView} lowStockCount={lowStockCount} />

      <main className="flex-1 mr-0 md:mr-72 min-h-screen overflow-x-hidden">
        <div className="sticky top-0 z-20 md:hidden h-14" />
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto relative">
          <button
            onClick={() => setShowSettings(true)}
            className="fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-slate-800/80 backdrop-blur-xl border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
            title="الإعدادات"
          >
            <Settings className="w-5 h-5" />
          </button>

          {loading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="animate-fade-in">
              {view === 'dashboard' && <Dashboard parts={parts} invoices={invoices} setView={setView} />}
              {view === 'parts' && <PartsManager parts={parts} refresh={refreshAll} />}
              {view === 'create-invoice' && <InvoiceCreator parts={parts} refresh={refreshAll} />}
              {view === 'invoices' && <InvoicesList invoices={invoices} refresh={refreshAll} parts={parts} />}
              {view === 'search' && <DeepSearch parts={parts} refresh={refreshAll} />}
              {view === 'monthly' && <MonthlyReport invoices={invoices} />}
              {view === 'alerts' && <LowStockAlerts parts={parts} refresh={refreshAll} />}
            </div>
          )}
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
