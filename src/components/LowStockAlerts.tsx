import { useState, useEffect } from 'react';
import { AlertTriangle, Package, Save, X, Edit2, TrendingDown, Undo2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Part, InvoiceItem } from '../lib/types';
import { toNumber } from '../lib/numeric';

interface Props {
  parts: Part[];
  refresh: () => Promise<void>;
}

export default function LowStockAlerts({ parts, refresh }: Props) {
  const [editing, setEditing] = useState<Part | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [returnedItems, setReturnedItems] = useState<InvoiceItem[]>([]);

  const outOfStock = parts.filter(p => p.quantity === 0);
  const lowStock = parts.filter(p => p.quantity > 0 && p.quantity <= p.min_quantity);
  const allAlerts = [...outOfStock, ...lowStock];

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('invoice_items')
        .select('*, invoices(invoice_number, buyer_name, created_at)')
        .eq('is_returned', true)
        .order('returned_at', { ascending: false });
      setReturnedItems((data as unknown as InvoiceItem[]) || []);
    })();
  }, [parts]);

  const startEdit = (part: Part) => { setEditing(part); setEditQty(part.quantity); };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from('parts').update({ quantity: editQty }).eq('id', editing.id);
    if (error) { alert(error.message); return; }
    setEditing(null); await refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-1">التنبيهات</h2>
        <p className="text-slate-400">قطع تحتاج إعادة طلب، كميات منخفضة، وقطع مرتجعة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card border-red-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
            <div><p className="text-sm text-slate-400">نفدت من المخزون</p><p className="text-2xl font-bold text-red-400">{outOfStock.length}</p></div>
          </div>
        </div>
        <div className="stat-card border-amber-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><TrendingDown className="w-6 h-6 text-amber-400" /></div>
            <div><p className="text-sm text-slate-400">كمية منخفضة</p><p className="text-2xl font-bold text-amber-400">{lowStock.length}</p></div>
          </div>
        </div>
        <div className="stat-card border-cyan-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Undo2 className="w-6 h-6 text-cyan-400" /></div>
            <div><p className="text-sm text-slate-400">قطع مرتجعة</p><p className="text-2xl font-bold text-cyan-400">{returnedItems.length}</p></div>
          </div>
        </div>
      </div>

      {returnedItems.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Undo2 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-lg">القطع المرتجعة</h3>
            <span className="badge bg-cyan-500/20 text-cyan-400">{returnedItems.length}</span>
          </div>
          <div className="space-y-2">
            {returnedItems.map((item) => {
              const inv = (item as unknown as { invoices?: { invoice_number: string; buyer_name: string; created_at: string } }).invoices;
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Undo2 className="w-5 h-5 text-cyan-400" /></div>
                    <div>
                      <p className="font-semibold line-through text-slate-400">{item.part_name}</p>
                      <p className="text-xs text-slate-500">{item.part_code} — {item.manufacturer} — {item.car_brand}</p>
                      {inv && <p className="text-xs text-cyan-400 mt-0.5">فاتورة: {inv.invoice_number} — {inv.buyer_name || 'بدون اسم'}</p>}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-cyan-400">{item.quantity} قطعة</p>
                    <p className="text-xs text-slate-500">{Number(item.subtotal).toLocaleString('ar-EG')} ج.م</p>
                    {item.returned_at && <p className="text-xs text-slate-500">{new Date(item.returned_at).toLocaleDateString('ar-EG')}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allAlerts.length === 0 && returnedItems.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-emerald-400/50" />
          <p className="text-xl font-bold text-emerald-400">كل القطع متوفرة بكميات جيدة</p>
          <p className="text-slate-400 mt-1">لا توجد تنبيهات أو مرتجعات حالياً</p>
        </div>
      ) : allAlerts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> تنبيهات النقص</h3>
          {allAlerts.map(part => (
            <div key={part.id} className={`glass-card p-4 flex flex-wrap items-center justify-between gap-4 ${part.quantity === 0 ? 'border-red-500/20' : 'border-amber-500/20'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${part.quantity === 0 ? 'bg-red-500/10' : 'bg-amber-500/10'}`}><Package className={`w-6 h-6 ${part.quantity === 0 ? 'text-red-400' : 'text-amber-400'}`} /></div>
                <div><p className="font-bold text-lg">{part.name}</p><p className="text-sm text-slate-400">{part.code} — {part.car_brand} — {part.manufacturer}</p></div>
              </div>
              <div className="flex items-center gap-4">
                {editing?.id === part.id ? (
                  <div className="flex items-center gap-2">
                    <input type="text" inputMode="numeric" value={editQty} onChange={(e) => setEditQty(toNumber(e.target.value))} className="input-field w-24 py-1.5" />
                    <button onClick={saveEdit} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Save className="w-4 h-4" /></button>
                    <button onClick={() => setEditing(null)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <div className="text-left"><p className={`text-2xl font-bold ${part.quantity === 0 ? 'text-red-400' : 'text-amber-400'}`}>{part.quantity}</p><p className="text-xs text-slate-500">حد التنبيه: {part.min_quantity}</p></div>
                    <button onClick={() => startEdit(part)} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5"><Edit2 className="w-4 h-4" /> تعديل الكمية</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
