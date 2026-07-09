import { useState } from 'react';
import { Search, Package, Edit2, Save, X, AlertTriangle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Part } from '../lib/types';
import { useFinancialUnlock } from '../lib/useFinancialUnlock';
import { toNumber } from '../lib/numeric';
import PasswordPrompt from './PasswordPrompt';

interface Props {
  parts: Part[];
  refresh: () => Promise<void>;
}

export default function DeepSearch({ parts, refresh }: Props) {
  const { unlocked } = useFinancialUnlock();
  const [showPrompt, setShowPrompt] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Part[]>([]);
  const [searched, setSearched] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editPrice, setEditPrice] = useState(0);

  const doSearch = () => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    const q = query.toLowerCase();
    const found = parts.filter(p =>
      p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.car_brand.toLowerCase().includes(q) ||
      p.car_model.toLowerCase().includes(q) || p.manufacturer.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
    setResults(found); setSearched(true);
  };

  const startEdit = (part: Part) => { setEditing(part); setEditQty(part.quantity); setEditPrice(Number(part.price)); };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from('parts').update({ quantity: editQty, price: editPrice }).eq('id', editing.id);
    if (error) { alert(error.message); return; }
    setEditing(null); await refresh(); doSearch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-1">البحث العميق</h2>
        <p className="text-slate-400">ابحث عن أي قطعة بالكود أو الاسم أو ماركة السيارة — بدون فاتورة</p>
      </div>

      <div className="glass-card p-6">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
          <input type="text" placeholder="اكتب الكود أو اسم القطعة أو ماركة السيارة..." value={query} onChange={(e) => { setQuery(e.target.value); setSearched(false); }} onKeyDown={(e) => e.key === 'Enter' && doSearch()} className="input-field pr-14 py-4 text-lg" autoFocus />
        </div>
        <button onClick={doSearch} className="btn-primary w-full mt-3 py-3 flex items-center justify-center gap-2"><Search className="w-5 h-5" /> بحث</button>
      </div>

      {searched && (
        <div className="space-y-3">
          <p className="text-slate-400">{results.length > 0 ? `${results.length} نتيجة` : 'لا توجد نتائج'}</p>
          {results.map(part => (
            <div key={part.id} className="glass-card p-5 animate-fade-in">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${part.quantity === 0 ? 'bg-red-500/10' : part.quantity <= part.min_quantity ? 'bg-amber-500/10' : 'bg-cyan-500/10'}`}>
                    <Package className={`w-7 h-7 ${part.quantity === 0 ? 'text-red-400' : part.quantity <= part.min_quantity ? 'text-amber-400' : 'text-cyan-400'}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{part.name}</h3>
                    <p className="font-mono text-sm text-cyan-400">{part.code}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {part.manufacturer && <span className="badge bg-slate-800 text-slate-300">{part.manufacturer}</span>}
                      {part.car_brand && <span className="badge bg-slate-800 text-slate-300">{part.car_brand}</span>}
                      {part.car_model && <span className="badge bg-slate-800 text-slate-300">{part.car_model}</span>}
                      {part.category && <span className="badge bg-slate-800 text-slate-300">{part.category}</span>}
                      {part.origin && <span className="badge bg-slate-800 text-slate-300">{part.origin}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {editing?.id === part.id ? (
                    <div className="flex items-center gap-2">
                      <div><label className="text-xs text-slate-400 block mb-1">السعر</label><input type="text" inputMode="decimal" value={editPrice} onChange={(e) => setEditPrice(toNumber(e.target.value))} className="input-field w-24 py-1.5" /></div>
                      <div><label className="text-xs text-slate-400 block mb-1">الكمية</label><input type="text" inputMode="numeric" value={editQty} onChange={(e) => setEditQty(toNumber(e.target.value))} className="input-field w-20 py-1.5" /></div>
                      <div className="flex gap-1 mt-5">
                        <button onClick={saveEdit} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-left"><p className="text-3xl font-bold text-cyan-400">{Number(part.price).toLocaleString('ar-EG')} <span className="text-base font-normal text-slate-400">ج.م</span></p></div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${part.quantity === 0 ? 'bg-red-500/20 text-red-400' : part.quantity <= part.min_quantity ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {part.quantity === 0 ? <><AlertTriangle className="w-3 h-3" /> نفدت</> : <>متبقي: {part.quantity}</>}
                        </span>
                        {part.quantity > 0 && part.quantity <= part.min_quantity && <span className="badge bg-amber-500/20 text-amber-400"><AlertTriangle className="w-3 h-3" /> كمية منخفضة</span>}
                      </div>
                      <button onClick={() => startEdit(part)} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5"><Edit2 className="w-4 h-4" /> تعديل</button>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
                <div>
                  <p className="text-xs text-slate-500">التكلفة</p>
                  {unlocked ? <p className="font-semibold">{Number(part.cost).toLocaleString('ar-EG')} ج.م</p> : <button onClick={() => setShowPrompt(true)} className="text-amber-400 text-sm flex items-center gap-1"><Lock className="w-3 h-3" /> مقفل</button>}
                </div>
                <div>
                  <p className="text-xs text-slate-500">الربح للقطعة</p>
                  {unlocked ? <p className="font-semibold text-emerald-400">{(Number(part.price) - Number(part.cost)).toLocaleString('ar-EG')} ج.م</p> : <button onClick={() => setShowPrompt(true)} className="text-amber-400 text-sm flex items-center gap-1"><Lock className="w-3 h-3" /> مقفل</button>}
                </div>
                <div><p className="text-xs text-slate-500">حد التنبيه</p><p className="font-semibold">{part.min_quantity}</p></div>
                <div><p className="text-xs text-slate-500">قيمة المخزون</p><p className="font-semibold">{(Number(part.price) * part.quantity).toLocaleString('ar-EG')} ج.م</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPrompt && <PasswordPrompt onSuccess={() => setShowPrompt(false)} onCancel={() => setShowPrompt(false)} />}
    </div>
  );
}
