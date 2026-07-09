import { LayoutDashboard, Package, FilePlus, FileText, Search, BarChart3, AlertTriangle, Wrench } from 'lucide-react';
import type { View } from '../App';

interface Props {
  view: View;
  setView: (v: View) => void;
  lowStockCount: number;
}

const menuItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'parts', label: 'إدارة القطع', icon: Package },
  { id: 'create-invoice', label: 'فاتورة جديدة', icon: FilePlus },
  { id: 'invoices', label: 'الفواتير', icon: FileText },
  { id: 'search', label: 'البحث العميق', icon: Search },
  { id: 'monthly', label: 'التقارير الشهرية', icon: BarChart3 },
  { id: 'alerts', label: 'تنبيهات النقص', icon: AlertTriangle },
];

export default function Sidebar({ view, setView, lowStockCount }: Props) {
  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-7 h-7 text-cyan-400" />
          <span className="font-bold text-lg">قطع الغيار</span>
        </div>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as View)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
        >
          {menuItems.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>

      <aside className="hidden md:flex fixed right-0 top-0 bottom-0 w-72 bg-slate-900/80 backdrop-blur-xl border-l border-slate-800 flex-col z-30">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
              <Wrench className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">نظام قطع الغيار</h1>
              <p className="text-xs text-slate-400">كوري وياباني</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-l from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-right">{item.label}</span>
                {item.id === 'alerts' && lowStockCount > 0 && (
                  <span className="badge bg-red-500/20 text-red-400 animate-pulse-glow">
                    {lowStockCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-slate-400">حالة المخزون</p>
            <p className="text-2xl font-bold mt-1">
              {lowStockCount > 0 ? (
                <span className="text-red-400">{lowStockCount} نقص</span>
              ) : (
                <span className="text-emerald-400">ممتاز</span>
              )}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
