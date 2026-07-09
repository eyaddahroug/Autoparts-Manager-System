import { Package, FileText, TrendingUp, AlertTriangle, CheckCircle, Clock, DollarSign, ShoppingCart, Search } from 'lucide-react';
import type { Part, InvoiceWithItems } from '../lib/types';
import type { View } from '../App';
import { useFinancialUnlock } from '../lib/useFinancialUnlock';
import { useState } from 'react';
import PasswordPrompt from './PasswordPrompt';

interface Props {
  parts: Part[];
  invoices: InvoiceWithItems[];
  setView: (v: View) => void;
}

export default function Dashboard({ parts, invoices, setView }: Props) {
  const { unlocked } = useFinancialUnlock();
  const [showPrompt, setShowPrompt] = useState(false);

  const totalParts = parts.length;
  const totalStock = parts.reduce((sum, p) => sum + p.quantity, 0);
  const lowStock = parts.filter(p => p.quantity <= p.min_quantity);
  const outOfStock = parts.filter(p => p.quantity === 0);

  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(inv => new Date(inv.created_at).toDateString() === today);

  const computePaidAmount = (inv: InvoiceWithItems) =>
    inv.payments.reduce((s, p) => s + Number(p.amount), 0);

  const computeEffectiveTotal = (inv: InvoiceWithItems) => {
    const returnedSubtotal = inv.items
      .filter(it => it.is_returned)
      .reduce((s, it) => s + Number(it.subtotal), 0);
    return (Number(inv.total_amount) || 0) - returnedSubtotal;
  };

  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + computeEffectiveTotal(inv), 0);
  const todayCost = todayInvoices.reduce((sum, inv) => {
    const returnedCost = inv.items.filter(it => it.is_returned).reduce((s, it) => s + Number(it.unit_cost) * it.quantity, 0);
    return sum + ((Number(inv.total_cost) || 0) - returnedCost);
  }, 0);
  const todayProfit = todayRevenue - todayCost;

  const allInvoicesRevenue = invoices.reduce((sum, inv) => sum + computeEffectiveTotal(inv), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + computePaidAmount(inv), 0);
  const totalRemaining = allInvoicesRevenue - totalPaid;

  const stats = [
    { label: 'إجمالي القطع', value: totalParts, sub: `${totalStock} قطعة في المخزون`, icon: Package, color: 'from-cyan-500 to-blue-600', onClick: () => setView('parts') },
    { label: 'فواتير اليوم', value: todayInvoices.length, sub: `${todayRevenue.toLocaleString('ar-EG')} ج.م`, icon: FileText, color: 'from-emerald-500 to-teal-600', onClick: () => setView('invoices') },
    { label: 'تنبيهات النقص', value: lowStock.length, sub: outOfStock.length > 0 ? `${outOfStock.length} نفدت` : 'كل شيء بخير', icon: AlertTriangle, color: 'from-red-500 to-rose-600', onClick: () => setView('alerts') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-1">لوحة التحكم</h2>
        <p className="text-slate-400">نظرة عامة على المتجر — {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button key={i} onClick={stat.onClick} className="stat-card text-right hover:border-slate-700 transition-all duration-200 hover:scale-[1.02] group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1">{stat.value.toLocaleString('ar-EG')}</p>
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>
            </button>
          );
        })}
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg">ربح اليوم</h3>
          </div>
          {!unlocked && (
            <button onClick={() => setShowPrompt(true)} className="text-amber-400 text-sm font-semibold flex items-center gap-1.5 hover:text-amber-300">
              <TrendingUp className="w-4 h-4" /> عرض التفاصيل المالية
            </button>
          )}
        </div>
        {unlocked ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-1">إيرادات اليوم</p>
              <p className="text-2xl font-bold text-cyan-400">{todayRevenue.toLocaleString('ar-EG')} ج.م</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-1">تكلفة اليوم</p>
              <p className="text-2xl font-bold text-slate-300">{todayCost.toLocaleString('ar-EG')} ج.م</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-1">صافي ربح اليوم</p>
              <p className="text-2xl font-bold text-emerald-400">{todayProfit.toLocaleString('ar-EG')} ج.م</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-6">التفاصيل المالية مقفلة — اضغط على "عرض التفاصيل المالية" وأدخل كلمة السر</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-400" /></div>
            <div><p className="text-sm text-slate-400">إجمالي المدفوع</p><p className="text-xs text-slate-500">{invoices.length} فاتورة</p></div>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{totalPaid.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-400" /></div>
            <div><p className="text-sm text-slate-400">المتبقي</p><p className="text-xs text-slate-500">غير محصل</p></div>
          </div>
          <p className="text-2xl font-bold text-amber-400">{totalRemaining.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-cyan-400" /></div>
            <div><p className="text-sm text-slate-400">إجمالي القيمة</p><p className="text-xs text-slate-500">بعد المرتجع والخصم</p></div>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{allInvoicesRevenue.toLocaleString('ar-EG')} ج.م</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-bold text-lg">قطع تحتاج إعادة طلب</h3>
            </div>
            <button onClick={() => setView('alerts')} className="text-cyan-400 text-sm font-semibold hover:text-cyan-300">عرض الكل</button>
          </div>
          <div className="space-y-2">
            {lowStock.slice(0, 5).map((part) => (
              <div key={part.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-10 rounded-full ${part.quantity === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="font-semibold">{part.name}</p>
                    <p className="text-xs text-slate-400">{part.code} — {part.car_brand}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className={`font-bold ${part.quantity === 0 ? 'text-red-400' : 'text-amber-400'}`}>{part.quantity} متبقي</p>
                  <p className="text-xs text-slate-500">حد التنبيه: {part.min_quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => setView('create-invoice')} className="glass-card p-6 flex items-center gap-4 hover:border-cyan-500/30 transition-all duration-200 hover:scale-[1.02] text-right">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <ShoppingCart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">إنشاء فاتورة جديدة</h3>
            <p className="text-sm text-slate-400">ابحث عن القطع وأضفها للفاتورة</p>
          </div>
        </button>
        <button onClick={() => setView('search')} className="glass-card p-6 flex items-center gap-4 hover:border-cyan-500/30 transition-all duration-200 hover:scale-[1.02] text-right">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Search className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">البحث العميق عن قطعة</h3>
            <p className="text-sm text-slate-400">ابحث بالكود أو الاسم أو ماركة السيارة</p>
          </div>
        </button>
      </div>

      {showPrompt && <PasswordPrompt onSuccess={() => setShowPrompt(false)} onCancel={() => setShowPrompt(false)} />}
    </div>
  );
}
