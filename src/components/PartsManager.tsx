import { useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Download, Upload, FileSpreadsheet, X, Save, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Part } from '../lib/types';
import { exportPartsToExcel, importPartsFromExcel, downloadPartsTemplate } from '../lib/excel';
import { useFinancialUnlock } from '../lib/useFinancialUnlock';
import { toNumber } from '../lib/numeric';
import PasswordPrompt from './PasswordPrompt';

interface Props {
  parts: Part[];
  refresh: () => Promise<void>;
}

const emptyPart: Omit<Part, 'id' | 'created_at' | 'updated_at'> = {
  code: '', name: '', manufacturer: '', car_brand: '', car_model: '',
  price: 0, cost: 0, quantity: 0, min_quantity: 5, category: '', origin: '',
};

export default function PartsManager({ parts, refresh }: Props) {
  const { unlocked } = useFinancialUnlock();
  const [showPrompt, setShowPrompt] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState(emptyPart);
  const [importStatus, setImportStatus] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const origins = [...new Set(parts.map(p => p.origin).filter(Boolean))];
  const brands = [...new Set(parts.map(p => p.car_brand).filter(Boolean))];

  const filtered = parts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.car_brand.toLowerCase().includes(q) ||
      p.manufacturer.toLowerCase().includes(q);
    const matchOrigin = !filterOrigin || p.origin === filterOrigin;
    const matchBrand = !filterBrand || p.car_brand === filterBrand;
    return matchSearch && matchOrigin && matchBrand;
  });

  const openAdd = () => { setEditingPart(null); setFormData(emptyPart); setShowModal(true); };
  const openEdit = (part: Part) => { setEditingPart(part); setFormData({ ...part }); setShowModal(true); };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) { setImportErrors(['الكود واسم القطعة مطلوبان']); return; }
    if (editingPart) {
      const { error } = await supabase.from('parts').update(formData).eq('id', editingPart.id);
      if (error) { setImportErrors([error.message]); return; }
    } else {
      const { error } = await supabase.from('parts').insert(formData);
      if (error) { setImportErrors([error.message]); return; }
    }
    setShowModal(false); setImportErrors([]); await refresh();
  };

  const handleDelete = async (part: Part) => {
    if (!confirm(`حذف القطعة "${part.name}" (${part.code})؟`)) return;
    const { error } = await supabase.from('parts').delete().eq('id', part.id);
    if (error) { alert(error.message); return; }
    await refresh();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('جاري الاستيراد...'); setImportErrors([]);
    try {
      const result = await importPartsFromExcel(file);
      setImportStatus(`تم إضافة ${result.added} وتحديث ${result.updated} قطعة`);
      setImportErrors(result.errors);
      await refresh();
    } catch (err) {
      setImportStatus(`خطأ: ${(err as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const updateField = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-1">إدارة قطع الغيار</h2>
          <p className="text-slate-400">{parts.length} قطعة في النظام</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus className="w-5 h-5" /> إضافة قطعة</button>
          <button onClick={() => exportPartsToExcel()} className="btn-secondary flex items-center gap-2"><Download className="w-5 h-5" /> تصدير Excel</button>
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2"><Upload className="w-5 h-5" /> استيراد Excel</button>
          <button onClick={downloadPartsTemplate} className="btn-secondary flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> نموذج</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {importStatus && (
        <div className={`glass-card p-4 ${importErrors.length > 0 ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
          <p className="font-semibold">{importStatus}</p>
          {importErrors.length > 0 && (
            <ul className="mt-2 text-sm text-amber-400 space-y-1">{importErrors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}</ul>
          )}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input type="text" placeholder="بحث بالكود أو الاسم أو الماركة..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-11" />
          </div>
          <select value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)} className="input-field">
            <option value="">كل المنشأ</option>
            {origins.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="input-field">
            <option value="">كل الماركات</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-sm">
                <th className="px-4 py-3 text-right font-semibold">الكود</th>
                <th className="px-4 py-3 text-right font-semibold">القطعة</th>
                <th className="px-4 py-3 text-right font-semibold">المصنع</th>
                <th className="px-4 py-3 text-right font-semibold">ماركة السيارة</th>
                <th className="px-4 py-3 text-right font-semibold">السعر</th>
                <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                <th className="px-4 py-3 text-right font-semibold">المنشأ</th>
                <th className="px-4 py-3 text-center font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">{parts.length === 0 ? 'لا توجد قطع. ابدأ بإضافة قطعة أو استيراد من Excel' : 'لا نتائج للبحث'}</td></tr>
              ) : (
                filtered.map((part) => (
                  <tr key={part.id} className="table-row-hover">
                    <td className="px-4 py-3 font-mono text-sm text-cyan-400">{part.code}</td>
                    <td className="px-4 py-3 font-semibold">{part.name}</td>
                    <td className="px-4 py-3 text-slate-300">{part.manufacturer || '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{part.car_brand || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{Number(part.price).toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${part.quantity === 0 ? 'bg-red-500/20 text-red-400' : part.quantity <= part.min_quantity ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{part.quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{part.origin || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(part)} className="p-2 rounded-lg hover:bg-slate-700 text-cyan-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(part)} className="p-2 rounded-lg hover:bg-slate-700 text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-xl">
              <h3 className="text-xl font-bold">{editingPart ? 'تعديل قطعة' : 'إضافة قطعة جديدة'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm text-slate-400 mb-1.5">الكود *</label><input type="text" value={formData.code} onChange={(e) => updateField('code', e.target.value)} className="input-field" placeholder="HY-001" /></div>
                <div><label className="block text-sm text-slate-400 mb-1.5">اسم القطعة *</label><input type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="input-field" placeholder="فلتر زيت" /></div>
                <div><label className="block text-sm text-slate-400 mb-1.5">المصنع</label><input type="text" value={formData.manufacturer} onChange={(e) => updateField('manufacturer', e.target.value)} className="input-field" placeholder="Hyundai OEM" /></div>
                <div><label className="block text-sm text-slate-400 mb-1.5">ماركة السيارة</label><input type="text" value={formData.car_brand} onChange={(e) => updateField('car_brand', e.target.value)} className="input-field" placeholder="هيونداي" /></div>
                <div><label className="block text-sm text-slate-400 mb-1.5">موديل السيارة</label><input type="text" value={formData.car_model} onChange={(e) => updateField('car_model', e.target.value)} className="input-field" placeholder="إلنترا, سوناتا" /></div>
                <div><label className="block text-sm text-slate-400 mb-1.5">التصنيف</label><input type="text" value={formData.category} onChange={(e) => updateField('category', e.target.value)} className="input-field" placeholder="فلاتر" /></div>
                <div><label className="block text-sm text-slate-400 mb-1.5">السعر (ج.م)</label><input type="text" inputMode="decimal" value={formData.price} onChange={(e) => updateField('price', toNumber(e.target.value))} className="input-field" /></div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    التكلفة (ج.م) {unlocked ? null : <button type="button" onClick={() => setShowPrompt(true)} className="inline-flex items-center gap-1 text-amber-400 text-xs"><Lock className="w-3 h-3" /> مقفل</button>}
                  </label>
                  {unlocked
                    ? <input type="text" inputMode="decimal" value={formData.cost} onChange={(e) => updateField('cost', toNumber(e.target.value))} className="input-field" />
                    : <input type="text" value="••••" disabled className="input-field opacity-50" />}
                </div>
                <div><label className="block text-sm text-slate-400 mb-1.5">الكمية</label><input type="text" inputMode="numeric" value={formData.quantity} onChange={(e) => updateField('quantity', toNumber(e.target.value))} className="input-field" /></div>
                <div><label className="block text-sm text-slate-400 mb-1.5">حد التنبيه</label><input type="text" inputMode="numeric" value={formData.min_quantity} onChange={(e) => updateField('min_quantity', toNumber(e.target.value))} className="input-field" /></div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">المنشأ</label>
                  <select value={formData.origin} onChange={(e) => updateField('origin', e.target.value)} className="input-field">
                    <option value="">اختر...</option>
                    <option value="كوري">كوري</option>
                    <option value="ياباني">ياباني</option>
                    <option value="صيني">صيني</option>
                    <option value="ألماني">ألماني</option>
                    <option value="أمريكي">أمريكي</option>
                  </select>
                </div>
              </div>
              {importErrors.length > 0 && <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{importErrors.join(', ')}</div>}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-800 sticky bottom-0 bg-slate-900/95 backdrop-blur-xl">
              <button onClick={handleSave} className="btn-primary flex items-center gap-2 flex-1 justify-center"><Save className="w-5 h-5" /> حفظ</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showPrompt && <PasswordPrompt onSuccess={() => setShowPrompt(false)} onCancel={() => setShowPrompt(false)} />}
    </div>
  );
}
