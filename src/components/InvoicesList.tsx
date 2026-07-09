import { useState, useEffect } from 'react';
import { Search, Download, Eye, Check, Clock, X, FileText, Printer, Edit2, Undo2, DollarSign, Tag, Plus } from 'lucide-react';
import PasswordPrompt from './PasswordPrompt';
import { supabase } from '../lib/supabase';
import { normalizeDigits, toNumber } from '../lib/numeric';
import type { InvoiceWithItems, Payment, Part } from '../lib/types';
import { exportInvoicesToExcel } from '../lib/excel';
import InvoiceCreator from './InvoiceCreator';

interface Props {
  invoices: InvoiceWithItems[];
  refresh: () => Promise<void>;
  parts: Part[];
}

type FilterStatus = 'all' | 'paid' | 'partial' | 'unpaid';

export default function InvoicesList({ invoices, refresh, parts }: Props) {
  
  const [showPrompt, setShowPrompt] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selected, setSelected] = useState<InvoiceWithItems | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithItems | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNoteDraft(selected?.notes || '');
  }, [selected?.id]);

  const computePaidAmount = (inv: InvoiceWithItems) =>
    inv.payments.reduce((s, p) => s + Number(p.amount), 0);

  const computeReturnedSubtotal = (inv: InvoiceWithItems) =>
    inv.items.filter(it => it.is_returned).reduce((s, it) => s + Number(it.subtotal), 0);

  const computeEffectiveTotal = (inv: InvoiceWithItems) =>
    (Number(inv.total_amount) || 0) - computeReturnedSubtotal(inv);

  const computeRemaining = (inv: InvoiceWithItems) =>
    computeEffectiveTotal(inv) - computePaidAmount(inv);

  const getPaymentStatus = (inv: InvoiceWithItems): 'paid' | 'partial' | 'unpaid' => {
    const remaining = computeRemaining(inv);
    if (remaining <= 0) return 'paid';
    const paid = computePaidAmount(inv);
    if (paid > 0) return 'partial';
    return 'unpaid';
  };

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase();
    const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q) || inv.buyer_name.toLowerCase().includes(q) || inv.car_brand.toLowerCase().includes(q);
    const status = getPaymentStatus(inv);
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });

  const totalPaid = invoices.reduce((s, i) => s + computePaidAmount(i), 0);
  const totalRemaining = invoices.reduce((s, i) => s + Math.max(0, computeRemaining(i)), 0);
  const totalValue = invoices.reduce((s, i) => s + computeEffectiveTotal(i), 0);

  const addPayment = async (inv: InvoiceWithItems) => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) { alert('أدخل مبلغاً صحيحاً'); return; }
    const remaining = computeRemaining(inv);
    if (amount > remaining) { alert(`المبلغ يتجاوز المتبقي (${remaining.toLocaleString('ar-EG')} ج.م)`); return; }

    const { error } = await supabase.from('payments').insert({
      invoice_id: inv.id, amount, note: paymentNote,
    });
    if (error) { alert(error.message); return; }

    const newRemaining = remaining - amount;
    const newIsPaid = newRemaining <= 0;
    await supabase.from('invoices').update({ is_paid: newIsPaid }).eq('id', inv.id);

    setPaymentAmount(''); setPaymentNote('');
    await refresh();
    const updated = invoices.find(i => i.id === inv.id);
    if (updated) {
      const { data: payments } = await supabase.from('payments').select('*').eq('invoice_id', inv.id);
      setSelected({ ...updated, payments: payments || [] });
    }
  };

  const markFullyPaid = async (inv: InvoiceWithItems) => {
    const remaining = computeRemaining(inv);
    if (remaining <= 0) return;
    const { error } = await supabase.from('payments').insert({
      invoice_id: inv.id, amount: remaining, note: 'تسجيل دفع كامل',
    });
    if (error) { alert(error.message); return; }
    await supabase.from('invoices').update({ is_paid: true }).eq('id', inv.id);
    await refresh();
  };

  const markUnpaid = async (inv: InvoiceWithItems) => {
    const paidSoFar = computePaidAmount(inv);
    if (paidSoFar > 0 && !confirm('هذه الفاتورة عليها دفعات مسجلة. تأشيرها كـ"غير مدفوعة" سيحذف كل الدفعات المسجلة عليها. متابعة؟')) return;
    const { data: payments } = await supabase.from('payments').select('*').eq('invoice_id', inv.id);
    for (const p of payments || []) {
      await supabase.from('payments').delete().eq('id', p.id);
    }
    await supabase.from('invoices').update({ is_paid: false }).eq('id', inv.id);
    await refresh();
  };

  const deletePayment = async (payment: Payment, inv: InvoiceWithItems) => {
    if (!confirm('حذف هذه الدفعة؟')) return;
    const { error } = await supabase.from('payments').delete().eq('id', payment.id);
    if (error) { alert(error.message); return; }
    await refresh();
    const { data: payments } = await supabase.from('payments').select('*').eq('invoice_id', inv.id);
    const updated = invoices.find(i => i.id === inv.id);
    if (updated) setSelected({ ...updated, payments: payments || [] });
  };

  const applyDiscount = async (inv: InvoiceWithItems) => {
    const amount = toNumber(discountAmount);
    if (!amount || amount <= 0) { alert('أدخل مبلغ خصم صحيح'); return; }
    const effective = computeEffectiveTotal(inv);
    if (amount > effective) { alert('الخصم يتجاوز قيمة الفاتورة'); return; }

    const newTotal = effective - amount;

    const { error } = await supabase.from('invoices').update({
      discount: amount,
      original_total: effective,
      total_amount: newTotal + computeReturnedSubtotal(inv),
    }).eq('id', inv.id);
    if (error) { alert(error.message); return; }

    // Reduce the recorded paid amount by the same discount, so the invoice
    // still nets to zero remaining (not "overpaid") instead of the discount
    // silently reducing what's owed.
    await supabase.from('payments').insert({
      invoice_id: inv.id, amount: -amount, note: 'تسوية خصم',
    });

    setDiscountAmount(''); setShowDiscount(false);
    await refresh();
  };

  const toggleItemReturned = async (inv: InvoiceWithItems, itemId: string, current: boolean) => {
    const { error } = await supabase.from('invoice_items').update({
      is_returned: !current,
      returned_at: !current ? new Date().toISOString() : null,
    }).eq('id', itemId);
    if (error) { alert(error.message); return; }
    await refresh();
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
    const updated = invoices.find(i => i.id === inv.id);
    if (updated) setSelected({ ...updated, items: items || [] });
  };

  const saveNote = async (inv: InvoiceWithItems) => {
    setSavingNote(true);
    const { error } = await supabase.from('invoices').update({ notes: noteDraft }).eq('id', inv.id);
    setSavingNote(false);
    if (error) { alert(error.message); return; }
    await refresh();
    setSelected({ ...inv, notes: noteDraft });
  };

  const deleteInvoice = async (inv: InvoiceWithItems) => {
    if (!confirm(`حذف الفاتورة ${inv.invoice_number}؟ سيتم إرجاع الكميات للمخزون.`)) return;
    for (const item of inv.items) {
      if (item.part_id && !item.is_returned) {
        const { data: part } = await supabase.from('parts').select('quantity').eq('id', item.part_id).maybeSingle();
        if (part) await supabase.from('parts').update({ quantity: part.quantity + item.quantity }).eq('id', item.part_id);
      }
    }
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (error) { alert(error.message); return; }
    await refresh();
    setSelected(null);
  };

  if (editingInvoice) {
    return <InvoiceCreator parts={parts} refresh={refresh} editingInvoice={editingInvoice} onCloseEdit={() => setEditingInvoice(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-3xl font-bold mb-1">الفواتير</h2><p className="text-slate-400">{invoices.length} فاتورة</p></div>
        <button onClick={() => exportInvoicesToExcel()} className="btn-secondary flex items-center gap-2"><Download className="w-5 h-5" /> تصدير Excel</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2"><Check className="w-5 h-5 text-emerald-400" /><span className="text-slate-400 text-sm">إجمالي المدفوع</span></div>
          <p className="text-2xl font-bold text-emerald-400">{totalPaid.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-5 h-5 text-amber-400" /><span className="text-slate-400 text-sm">المتبقي</span></div>
          <p className="text-2xl font-bold text-amber-400">{totalRemaining.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2"><FileText className="w-5 h-5 text-cyan-400" /><span className="text-slate-400 text-sm">القيمة الإجمالية</span></div>
          <p className="text-2xl font-bold text-cyan-400">{totalValue.toLocaleString('ar-EG')} ج.م</p>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input type="text" placeholder="بحث برقم الفاتورة أو اسم المشتري..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-11" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'paid', 'partial', 'unpaid'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2.5 rounded-xl font-semibold transition-all text-sm ${filter === f ? f === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : f === 'partial' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : f === 'unpaid' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700 text-slate-200 border border-slate-600' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              {f === 'all' ? 'الكل' : f === 'paid' ? 'مدفوعة' : f === 'partial' ? 'دفع جزئي' : 'غير مدفوعة'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-sm">
                <th className="px-4 py-3 text-right font-semibold">رقم الفاتورة</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">المشتري</th>
                <th className="px-4 py-3 text-right font-semibold">القطع</th>
                <th className="px-4 py-3 text-right font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right font-semibold">المدفوع</th>
                <th className="px-4 py-3 text-right font-semibold">المتبقي</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-center font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">لا توجد فواتير</td></tr>
              ) : (
                filtered.map(inv => {
                  const status = getPaymentStatus(inv);
                  const effective = computeEffectiveTotal(inv);
                  const paid = computePaidAmount(inv);
                  const remaining = computeRemaining(inv);
                  const hasDiscount = Number(inv.discount) > 0;
                  const hasReturns = inv.items.some(it => it.is_returned);
                  return (
                    <tr key={inv.id} className="table-row-hover">
                      <td className="px-4 py-3 font-mono text-sm text-cyan-400">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{new Date(inv.created_at).toLocaleDateString('ar-EG')}</td>
                      <td className="px-4 py-3">{inv.buyer_name || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {inv.items.length}
                        {hasReturns && <span className="text-xs text-red-400 block">{inv.items.filter(it => it.is_returned).length} مرتجع</span>}
                      </td>
                      <td className="px-4 py-3">
                        {hasDiscount ? (
                          <div>
                            <span className="line-through text-slate-500 text-sm">{(Number(inv.original_total)).toLocaleString('ar-EG')}</span>
                            <span className="font-bold text-emerald-400 block">{effective.toLocaleString('ar-EG')}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-emerald-400">{effective.toLocaleString('ar-EG')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-emerald-400">{paid.toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-3 text-amber-400">{Math.max(0, remaining).toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-3">
                        {status === 'paid' ? (
                          <button
                            onClick={() => markUnpaid(inv)}
                            title="اضغط لإلغاء تسجيل الدفع"
                            className="badge cursor-pointer hover:opacity-80 transition-opacity bg-emerald-500/20 text-emerald-400"
                          >
                            <Check className="w-3 h-3" /> مدفوعة
                          </button>
                        ) : (
                          <button
                            onClick={() => markFullyPaid(inv)}
                            title="اضغط لتسجيل الفاتورة كمدفوعة بالكامل"
                            className={`badge cursor-pointer hover:opacity-80 transition-opacity ${status === 'partial' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}
                          >
                            {status === 'partial' ? <><DollarSign className="w-3 h-3" /> دفع جزئي</> : <><Clock className="w-3 h-3" /> غير مدفوعة</>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setSelected(inv)} className="p-2 rounded-lg hover:bg-slate-700 text-cyan-400" title="عرض"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => setEditingInvoice(inv)} className="p-2 rounded-lg hover:bg-slate-700 text-amber-400" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => deleteInvoice(inv)} className="p-2 rounded-lg hover:bg-slate-700 text-red-400" title="حذف"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setSelected(null); setShowDiscount(false); }}>
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-xl z-10">
              <div><h3 className="text-xl font-bold">{selected.invoice_number}</h3><p className="text-sm text-slate-400">{new Date(selected.created_at).toLocaleString('ar-EG')}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingInvoice(selected)} className="p-2 rounded-lg hover:bg-slate-800 text-amber-400" title="تعديل"><Edit2 className="w-5 h-5" /></button>
                <button onClick={() => window.print()} className="p-2 rounded-lg hover:bg-slate-800 text-cyan-400"><Printer className="w-5 h-5" /></button>
                <button onClick={() => { setSelected(null); setShowDiscount(false); }} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-800/50">
                <div><p className="text-xs text-slate-400">المشتري</p><p className="font-semibold">{selected.buyer_name || '-'}</p></div>
                <div><p className="text-xs text-slate-400">السيارة</p><p className="font-semibold">{selected.car_brand} {selected.car_model}</p></div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-slate-400 text-sm border-b border-slate-800">
                      <th className="px-3 py-2 text-right">القطعة</th><th className="px-3 py-2 text-right">الكود</th><th className="px-3 py-2 text-center">كمية</th><th className="px-3 py-2 text-right">سعر</th><th className="px-3 py-2 text-right">إجمالي</th><th className="px-3 py-2 text-center">مرتجع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {selected.items.map(item => (
                      <tr key={item.id} className={item.is_returned ? 'bg-red-500/5' : ''}>
                        <td className="px-3 py-2 font-semibold"><span className={item.is_returned ? 'line-through text-slate-500' : ''}>{item.part_name}</span></td>
                        <td className="px-3 py-2 font-mono text-sm text-cyan-400">{item.part_code}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2">{Number(item.unit_price).toLocaleString('ar-EG')}</td>
                        <td className="px-3 py-2 font-bold text-emerald-400"><span className={item.is_returned ? 'line-through text-slate-500' : ''}>{Number(item.subtotal).toLocaleString('ar-EG')}</span></td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => toggleItemReturned(selected, item.id, item.is_returned)} className={`p-1.5 rounded-lg ${item.is_returned ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`} title={item.is_returned ? 'إلغاء المرتجع' : 'تأشير كمرتجع'}>
                            <Undo2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {Number(selected.discount) > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10">
                  <span className="text-amber-400 flex items-center gap-2"><Tag className="w-4 h-4" /> خصم</span>
                  <span className="text-amber-400 font-bold">-{Number(selected.discount).toLocaleString('ar-EG')} ج.م</span>
                </div>
              )}

              <div className="space-y-2 p-4 rounded-xl bg-slate-800/50">
                {Number(selected.discount) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">القيمة الأصلية</span>
                    <span className="line-through text-slate-500">{Number(selected.original_total).toLocaleString('ar-EG')} ج.م</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">الإجمالي المستحق</span>
                  <span className="text-2xl font-bold text-cyan-400">{computeEffectiveTotal(selected).toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-400">المدفوع</span>
                  <span className="font-semibold text-emerald-400">{computePaidAmount(selected).toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-400">المتبقي</span>
                  <span className="font-semibold text-amber-400">{Math.max(0, computeRemaining(selected)).toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>

              {/* Payments section */}
              <div className="glass-card p-4">
                <h4 className="font-bold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> الدفعات</h4>
                {selected.payments.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {selected.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                        <div>
                          <p className="font-semibold text-emerald-400">{Number(p.amount).toLocaleString('ar-EG')} ج.م</p>
                          <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString('ar-EG')}{p.note ? ` — ${p.note}` : ''}</p>
                        </div>
                        <button onClick={() => deletePayment(p, selected)} className="p-1.5 rounded-lg hover:bg-slate-700 text-red-400"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-500 mb-3">لا توجد دفعات مسجلة</p>}
                {computeRemaining(selected) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <input type="text" inputMode="decimal" placeholder="مبلغ الدفعة" value={paymentAmount} onChange={(e) => setPaymentAmount(normalizeDigits(e.target.value))} className="input-field flex-1 min-w-[120px]" />
                    <input type="text" placeholder="ملاحظة (اختياري)" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="input-field flex-1 min-w-[120px]" />
                    <button onClick={() => addPayment(selected)} className="btn-primary flex items-center gap-1.5"><Plus className="w-4 h-4" /> دفعة</button>
                  </div>
                )}
              </div>

              {/* Discount section */}
              {computeRemaining(selected) <= 0 && Number(selected.discount) === 0 && (
                <div className="glass-card p-4">
                  <button onClick={() => setShowDiscount(!showDiscount)} className="w-full flex items-center justify-between">
                    <span className="font-bold flex items-center gap-2"><Tag className="w-4 h-4 text-amber-400" /> خصم على الفاتورة</span>
                    <span className="text-slate-400 text-sm">{showDiscount ? 'إخفاء' : 'تطبيق خصم'}</span>
                  </button>
                  {showDiscount && (
                    <div className="flex gap-2 mt-3">
                      <input type="text" inputMode="decimal" placeholder="مبلغ الخصم" value={discountAmount} onChange={(e) => setDiscountAmount(normalizeDigits(e.target.value))} className="input-field flex-1" />
                      <button onClick={() => applyDiscount(selected)} className="btn-secondary">تطبيق</button>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-800/50 space-y-2">
                <p className="text-xs text-slate-400">ملاحظات</p>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="أضف ملحوظة على الفاتورة..."
                  className="input-field min-h-[70px] resize-none w-full"
                />
                {noteDraft !== (selected.notes || '') && (
                  <button onClick={() => saveNote(selected)} disabled={savingNote} className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5">
                    {savingNote ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> حفظ الملحوظة</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrompt && <PasswordPrompt onSuccess={() => setShowPrompt(false)} onCancel={() => setShowPrompt(false)} />}
    </div>
  );
}
