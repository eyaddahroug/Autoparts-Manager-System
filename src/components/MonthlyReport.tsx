import { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, Package, Award, Calendar, Check, Clock, Lock } from 'lucide-react';
import type { InvoiceWithItems } from '../lib/types';
import { useFinancialUnlock } from '../lib/useFinancialUnlock';
import PasswordPrompt from './PasswordPrompt';

interface Props {
  invoices: InvoiceWithItems[];
}

export default function MonthlyReport({ invoices }: Props) {
  const { unlocked } = useFinancialUnlock();
  const [showPrompt, setShowPrompt] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const computeEffectiveTotal = (inv: InvoiceWithItems) => {
    const returnedSubtotal = inv.items.filter(it => it.is_returned).reduce((s, it) => s + Number(it.subtotal), 0);
    return (Number(inv.total_amount) || 0) - returnedSubtotal;
  };

  const computeEffectiveCost = (inv: InvoiceWithItems) => {
    const returnedCost = inv.items.filter(it => it.is_returned).reduce((s, it) => s + Number(it.unit_cost) * it.quantity, 0);
    return (Number(inv.total_cost) || 0) - returnedCost;
  };

  const monthInvoices = useMemo(() => invoices.filter(inv => (inv.created_at || '').slice(0, 7) === month), [invoices, month]);
  const totalRevenue = monthInvoices.reduce((s, i) => s + computeEffectiveTotal(i), 0);
  const totalCost = monthInvoices.reduce((s, i) => s + computeEffectiveCost(i), 0);
  const totalProfit = totalRevenue - totalCost;
  const totalPaid = monthInvoices.reduce((s, i) => s + i.payments.reduce((sp, p) => sp + Number(p.amount), 0), 0);
  const totalRemaining = totalRevenue - totalPaid;

  const dailyData = useMemo(() => {
    const days: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};
    monthInvoices.forEach(inv => {
      const day = new Date(inv.created_at || Date.now()).toLocaleDateString('ar-EG');
      if (!days[day]) days[day] = { revenue: 0, cost: 0, profit: 0, count: 0 };
      const effTotal = computeEffectiveTotal(inv);
      const effCost = computeEffectiveCost(inv);
      days[day].revenue += effTotal;
      days[day].cost += effCost;
      days[day].profit += effTotal - effCost;
      days[day].count += 1;
    });
    return Object.entries(days).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [monthInvoices]);

  const salesRanking = useMemo(() => {
    const partStats: Record<string, { code: string; name: string; manufacturer: string; car_brand: string; totalQty: number; totalRevenue: number; returnedQty: number }> = {};
    monthInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.part_code;
        if (!partStats[key]) partStats[key] = { code: item.part_code, name: item.part_name, manufacturer: item.manufacturer, car_brand: item.car_brand, totalQty: 0, totalRevenue: 0, returnedQty: 0 };
        if (!item.is_returned) {
          partStats[key].totalQty += item.quantity;
          partStats[key].totalRevenue += Number(item.subtotal);
        } else {
          partStats[key].returnedQty += item.quantity;
        }
      });
    });
    return Object.values(partStats).sort((a, b) => b.totalQty - a.totalQty);
  }, [monthInvoices]);

  const maxRevenue = Math.max(...dailyData.map(([, d]) => d.revenue), 1);

  const stats = [
    { label: 'إجمالي المبيعات', value: totalRevenue, icon: DollarSign, color: 'from-cyan-500 to-blue-600', textColor: 'text-cyan-400' },
    { label: 'عدد الفواتير', value: monthInvoices.length, icon: ShoppingCart, color: 'from-violet-500 to-purple-600', textColor: 'text-violet-400' },
    { label: 'قطع مباعة', value: monthInvoices.reduce((s, i) => s + i.items.filter(it => !it.is_returned).reduce((q, it) => q + it.quantity, 0), 0), icon: Package, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-3xl font-bold mb-1">التقارير الشهرية</h2><p className="text-slate-400">تحليل الأرباح والمبيعات</p></div>
        <div className="relative">
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input-field pr-11" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="stat-card">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 shadow-lg`}><Icon className="w-6 h-6 text-white" /></div>
              <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value.toLocaleString('ar-EG')}</p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Profit card - protected */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg">صافي الربح</h3>
          </div>
          {!unlocked && (
            <button onClick={() => setShowPrompt(true)} className="text-amber-400 text-sm font-semibold flex items-center gap-1.5 hover:text-amber-300">
              <Lock className="w-4 h-4" /> عرض التفاصيل المالية
            </button>
          )}
        </div>
        {unlocked ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-1">الإيرادات</p>
              <p className="text-2xl font-bold text-cyan-400">{totalRevenue.toLocaleString('ar-EG')} ج.م</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-1">التكلفة</p>
              <p className="text-2xl font-bold text-slate-300">{totalCost.toLocaleString('ar-EG')} ج.م</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50">
              <p className="text-sm text-slate-400 mb-1">صافي الربح</p>
              <p className="text-2xl font-bold text-emerald-400">{totalProfit.toLocaleString('ar-EG')} ج.م</p>
              <p className="text-xs text-slate-500 mt-1">هامش: {totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0}%</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-6">التفاصيل المالية مقفلة</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2"><Check className="w-5 h-5 text-emerald-400" /><span className="text-slate-400 text-sm">المدفوع</span></div>
          <p className="text-2xl font-bold text-emerald-400">{totalPaid.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2"><Clock className="w-5 h-5 text-amber-400" /><span className="text-slate-400 text-sm">المتبقي</span></div>
          <p className="text-2xl font-bold text-amber-400">{totalRemaining.toLocaleString('ar-EG')} ج.م</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-bold text-lg mb-4">الأرباح اليومية</h3>
        {dailyData.length === 0 ? <p className="text-center text-slate-500 py-8">لا توجد بيانات لهذا الشهر</p> : (
          <div className="space-y-3">
            {dailyData.map(([day, data]) => (
              <div key={day} className="flex items-center gap-4">
                <div className="w-28 text-sm text-slate-400 shrink-0">{day}</div>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-slate-800 overflow-hidden relative">
                    <div className="h-full bg-gradient-to-l from-cyan-500 to-blue-600 transition-all duration-500 flex items-center justify-end px-3" style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}>
                      <span className="text-xs font-bold text-white whitespace-nowrap">{data.revenue.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>
                </div>
                <div className="w-24 text-left shrink-0">
                  {unlocked ? <p className="text-sm font-semibold text-emerald-400">+{data.profit.toLocaleString('ar-EG')}</p> : <p className="text-sm text-slate-500">مقفل</p>}
                  <p className="text-xs text-slate-500">{data.count} فاتورة</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4"><Award className="w-5 h-5 text-amber-400" /><h3 className="font-bold text-lg">ترتيب الأكثر مبيعاً</h3></div>
        {salesRanking.length === 0 ? <p className="text-center text-slate-500 py-8">لا توجد مبيعات لهذا الشهر</p> : (
          <div className="space-y-2">
            {salesRanking.map((item, i) => (
              <div key={item.code} className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-700/20 text-orange-400' : 'bg-slate-700/50 text-slate-500'}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.code} — {item.car_brand} — {item.manufacturer}</p>
                  {item.returnedQty > 0 && <p className="text-xs text-red-400">مرتجع: {item.returnedQty} قطعة</p>}
                </div>
                <div className="text-left shrink-0"><p className="font-bold text-cyan-400">{item.totalQty} قطعة</p><p className="text-xs text-slate-500">{item.totalRevenue.toLocaleString('ar-EG')} ج.م</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPrompt && <PasswordPrompt onSuccess={() => setShowPrompt(false)} onCancel={() => setShowPrompt(false)} />}
    </div>
  );
}
