import { useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, User, Car, Save, Undo2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toNumber, normalizeDigits } from '../lib/numeric';
import type { Part, InvoiceWithItems } from '../lib/types';

interface Props {
  parts: Part[];
  refresh: () => Promise<void>;
  editingInvoice?: InvoiceWithItems | null;
  onCloseEdit?: () => void;
}

interface CartItem {
  part: Part;
  quantity: number;
  unit_price: number;
  existingItemId?: string;
  is_returned?: boolean;
}

export default function InvoiceCreator({ parts, refresh, editingInvoice, onCloseEdit }: Props) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (editingInvoice) {
      return editingInvoice.items.map(item => ({
        part: {
          id: item.part_id || '',
          code: item.part_code,
          name: item.part_name,
          manufacturer: item.manufacturer,
          car_brand: item.car_brand,
          car_model: '',
          price: Number(item.unit_price),
          cost: Number(item.unit_cost),
          quantity: 0,
          min_quantity: 0,
          category: '',
          origin: '',
          created_at: '',
          updated_at: '',
        },
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        existingItemId: item.id,
        is_returned: item.is_returned,
      }));
    }
    return [];
  });
  const [buyerName, setBuyerName] = useState(editingInvoice?.buyer_name || '');
  const [carBrand, setCarBrand] = useState(editingInvoice?.car_brand || '');
  const [carModel, setCarModel] = useState(editingInvoice?.car_model || '');
  const [notes, setNotes] = useState(editingInvoice?.notes || '');
  const [markPaid, setMarkPaid] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const isEditing = !!editingInvoice;

  const searchResults = search.trim()
    ? parts.filter(p => {
        const q = search.toLowerCase();
        return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.car_brand.toLowerCase().includes(q) || p.car_model.toLowerCase().includes(q) || p.manufacturer.toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  const addToCart = (part: Part) => {
    const existing = cart.find(c => c.part.id === part.id);
    if (existing) {
      setCart(cart.map(c => c.part.id === part.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { part, quantity: 1, unit_price: Number(part.price) }]);
    }
    setSearch('');
  };

  const updateQty = (index: number, delta: number) => {
    setCart(cart.map((c, i) => {
      if (i !== index) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return c;
      return { ...c, quantity: newQty };
    }));
  };

  const setQty = (index: number, qty: number) => {
    setCart(cart.map((c, i) => i === index ? { ...c, quantity: Math.max(1, qty) } : c));
  };

  const setPrice = (index: number, price: number) => {
    setCart(cart.map((c, i) => i === index ? { ...c, unit_price: price } : c));
  };

  const toggleReturned = (index: number) => {
    setCart(cart.map((c, i) => i === index ? { ...c, is_returned: !c.is_returned } : c));
  };

  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));

  const activeItems = cart.filter(c => !c.is_returned);
  const returnedItems = cart.filter(c => c.is_returned);
  const totalAmount = activeItems.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);
  const totalCost = activeItems.reduce((sum, c) => sum + Number(c.part.cost) * c.quantity, 0);

  const generateInvoiceNumber = () => {
    const now = new Date();
    return `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${now.toTimeString().slice(0, 5).replace(/:/g, '')}`;
  };

  const handleSave = async () => {
    if (cart.length === 0) { alert('أضف قطعة واحدة على الأقل'); return; }
    setSaving(true); setSuccess('');

    try {
      if (isEditing && editingInvoice) {
        // Update existing invoice
        const { error: invError } = await supabase.from('invoices').update({
          buyer_name: buyerName, car_brand: carBrand, car_model: carModel,
          total_amount: totalAmount, total_cost: totalCost, notes,
        }).eq('id', editingInvoice.id);

        if (invError) { alert(`خطأ: ${invError.message}`); setSaving(false); return; }

        // Delete old items
        await supabase.from('invoice_items').delete().eq('invoice_id', editingInvoice.id);

        // Insert new items
        const items = cart.map(c => ({
          invoice_id: editingInvoice.id,
          part_id: c.part.id || null,
          part_code: c.part.code,
          part_name: c.part.name,
          manufacturer: c.part.manufacturer,
          car_brand: c.part.car_brand,
          quantity: c.quantity,
          unit_price: c.unit_price,
          unit_cost: Number(c.part.cost),
          subtotal: c.unit_price * c.quantity,
          is_returned: c.is_returned || false,
          returned_at: c.is_returned ? new Date().toISOString() : null,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(items);
        if (itemsError) { alert(`خطأ في حفظ التفاصيل: ${itemsError.message}`); setSaving(false); return; }

        setSuccess(`تم تحديث الفاتورة ${editingInvoice.invoice_number} بنجاح!`);
      } else {
        // Create new invoice
        const invoiceNumber = generateInvoiceNumber();
        const enteredPartial = toNumber(partialAmount);
        const hasPartial = enteredPartial > 0 && enteredPartial < totalAmount;
        const isFullyPaid = markPaid || (enteredPartial > 0 && enteredPartial >= totalAmount);
        const { data: invoice, error: invError } = await supabase.from('invoices').insert({
          invoice_number: invoiceNumber, buyer_name: buyerName, car_brand: carBrand, car_model: carModel,
          total_amount: totalAmount, total_cost: totalCost, is_paid: isFullyPaid, notes,
          discount: 0, original_total: totalAmount,
        }).select().single();

        if (invError) { alert(`خطأ: ${invError.message}`); setSaving(false); return; }

        if (isFullyPaid && totalAmount > 0) {
          await supabase.from('payments').insert({
            invoice_id: invoice.id, amount: totalAmount, note: 'دفع كامل عند إنشاء الفاتورة',
          });
        } else if (hasPartial) {
          await supabase.from('payments').insert({
            invoice_id: invoice.id, amount: enteredPartial, note: 'دفعة جزئية عند إنشاء الفاتورة',
          });
        }

        const items = cart.map(c => ({
          invoice_id: invoice.id, part_id: c.part.id, part_code: c.part.code, part_name: c.part.name,
          manufacturer: c.part.manufacturer, car_brand: c.part.car_brand, quantity: c.quantity,
          unit_price: c.unit_price, unit_cost: Number(c.part.cost), subtotal: c.unit_price * c.quantity,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(items);
        if (itemsError) { alert(`خطأ في حفظ التفاصيل: ${itemsError.message}`); setSaving(false); return; }

        // Decrement stock
        for (const c of cart) {
          if (c.part.id) {
            const { data: p } = await supabase.from('parts').select('quantity').eq('id', c.part.id).maybeSingle();
            if (p) await supabase.from('parts').update({ quantity: p.quantity - c.quantity }).eq('id', c.part.id);
          }
        }

        setSuccess(`تم حفظ الفاتورة ${invoiceNumber} بنجاح!`);
        setCart([]); setBuyerName(''); setCarBrand(''); setCarModel(''); setNotes(''); setMarkPaid(false); setPartialAmount('');
      }

      await refresh();
      setSaving(false);
      setTimeout(() => { setSuccess(''); if (isEditing && onCloseEdit) onCloseEdit(); }, 2000);
    } catch (err) {
      alert(`خطأ غير متوقع: ${(err as Error).message}`);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">{isEditing ? 'تعديل الفاتورة' : 'فاتورة جديدة'}</h2>
          <p className="text-slate-400">{isEditing ? editingInvoice?.invoice_number : 'ابحث عن القطع وأضفها لإنشاء فاتورة إلكترونية'}</p>
        </div>
        {isEditing && onCloseEdit && (
          <button onClick={onCloseEdit} className="btn-secondary flex items-center gap-2"><X className="w-5 h-5" /> إغلاق</button>
        )}
      </div>

      {success && (
        <div className="glass-card p-4 border-emerald-500/30 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><Check className="w-5 h-5 text-emerald-400" /></div>
          <p className="font-semibold text-emerald-400">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-bold text-lg mb-3">البحث عن قطعة</h3>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input type="text" placeholder="ابحث بالكود أو الاسم أو ماركة السيارة..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-11" autoFocus={!isEditing} />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map(part => (
                  <button key={part.id} onClick={() => addToCart(part)} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors text-right">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-10 rounded-full ${part.quantity === 0 ? 'bg-red-500' : part.quantity <= part.min_quantity ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <div>
                        <p className="font-semibold">{part.name}</p>
                        <p className="text-xs text-slate-400">{part.code} — {part.car_brand} — {part.manufacturer}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-cyan-400">{Number(part.price).toLocaleString('ar-EG')} ج.م</p>
                      <p className="text-xs text-slate-500">متوفر: {part.quantity}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {search.trim() && searchResults.length === 0 && <p className="mt-3 text-center text-slate-500 py-4">لا توجد نتائج</p>}
          </div>

          <div className="glass-card p-5 space-y-3">
            <h3 className="font-bold text-lg mb-2">بيانات المشتري</h3>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input type="text" placeholder="اسم المشتري" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="input-field pr-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Car className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="text" placeholder="ماركة السيارة" value={carBrand} onChange={(e) => setCarBrand(e.target.value)} className="input-field pr-11" />
              </div>
              <input type="text" placeholder="موديل السيارة" value={carModel} onChange={(e) => setCarModel(e.target.value)} className="input-field" />
            </div>
            <textarea placeholder="ملحوظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[60px] resize-none" />
          </div>
        </div>

        <div className="glass-card p-5 flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-cyan-400" /> السلة ({cart.length})</h3>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-red-400 text-sm hover:text-red-300">تفريغ</button>}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                <p>السلة فارغة</p><p className="text-sm">ابحث وأضف قطع للفاتورة</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={index} className={`p-3 rounded-xl animate-slide-in ${item.is_returned ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-800/50'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className={`font-semibold ${item.is_returned ? 'line-through text-slate-500' : ''}`}>{item.part.name}</p>
                      <p className="text-xs text-slate-400">{item.part.code} — {item.part.car_brand}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleReturned(index)} className={`p-1.5 rounded-lg ${item.is_returned ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`} title={item.is_returned ? 'إلغاء المرتجع' : 'تأشير كمرتجع'}>
                        <Undo2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeFromCart(index)} className="p-1.5 rounded-lg hover:bg-slate-700 text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {item.is_returned && <p className="text-xs text-red-400 mb-2">مرتجعة — تُخصم من الإجمالي</p>}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(index, -1)} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                      <input type="text" inputMode="numeric" value={item.quantity} onChange={(e) => setQty(index, toNumber(e.target.value))} className="w-14 text-center bg-slate-800 border border-slate-700 rounded-lg py-1" />
                      <button onClick={() => updateQty(index, 1)} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="decimal" value={item.unit_price} onChange={(e) => setPrice(index, toNumber(e.target.value))} className="w-20 text-center bg-slate-800 border border-slate-700 rounded-lg py-1 text-sm" />
                      <span className="text-xs text-slate-500">ج.م</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-cyan-400">{(item.unit_price * item.quantity).toLocaleString('ar-EG')} ج.م</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {cart.length > 0 && (
            <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
              {returnedItems.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-400">مرتجع ({returnedItems.length} قطعة)</span>
                  <span className="text-red-400">-{returnedItems.reduce((s, c) => s + c.unit_price * c.quantity, 0).toLocaleString('ar-EG')} ج.م</span>
                </div>
              )}
              <div className="flex items-center justify-between"><span className="text-slate-400">الإجمالي</span><span className="text-2xl font-bold text-cyan-400">{totalAmount.toLocaleString('ar-EG')} ج.م</span></div>
              {!isEditing && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-300">حالة الدفع</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setMarkPaid(false); setPartialAmount(''); }}
                      className={`py-2.5 rounded-xl font-semibold text-sm transition-colors ${!markPaid && !partialAmount ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}
                    >
                      لم يتم الدفع
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMarkPaid(true); setPartialAmount(''); }}
                      className={`py-2.5 rounded-xl font-semibold text-sm transition-colors ${markPaid ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}
                    >
                      تم الدفع
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="أو أدخل مبلغ مدفوع جزئيًا (اختياري)"
                    value={partialAmount}
                    onChange={(e) => { const v = normalizeDigits(e.target.value); setPartialAmount(v); if (v) setMarkPaid(false); }}
                    className="input-field text-sm"
                  />
                </div>
              )}
              <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-5 h-5" /> {isEditing ? 'تحديث الفاتورة' : 'حفظ الفاتورة'}</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
