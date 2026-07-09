import { useState, useEffect } from 'react';
import { Lock, Unlock, KeyRound, Save, Eye, EyeOff, Check, X } from 'lucide-react';
import { getSettings, setFinancialPassword, changeFinancialPassword, isFinancialUnlocked, lockFinancial, setUnlocked } from '../lib/financial';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [hasPassword, setHasPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [unlocked, setUnlockedState] = useState(isFinancialUnlocked());

  useEffect(() => {
    getSettings().then(s => setHasPassword(!!(s && s.financial_password)));
  }, []);

  const handleSetPassword = async () => {
    setMessage(''); setIsError(false);
    if (newPassword.length < 3) { setIsError(true); setMessage('كلمة السر يجب أن تكون 3 أحرف على الأقل'); return; }
    if (newPassword !== confirmPassword) { setIsError(true); setMessage('كلمتا السر غير متطابقتين'); return; }
    if (hasPassword && oldPassword !== newPassword) {
      const result = await changeFinancialPassword(oldPassword, newPassword);
      if (!result.success) { setIsError(true); setMessage(result.error || 'خطأ'); return; }
    } else {
      const ok = await setFinancialPassword(newPassword);
      if (!ok) { setIsError(true); setMessage('فشل الحفظ'); return; }
    }
    setIsError(false); setMessage('تم حفظ كلمة السر بنجاح');
    setHasPassword(true); setOldPassword(''); setNewPassword(''); setConfirmPassword('');
  };

  const toggleUnlock = () => {
    if (unlocked) { lockFinancial(); setUnlockedState(false); }
    else { setUnlockedState(true); setUnlocked(true); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-xl font-bold flex items-center gap-2"><KeyRound className="w-5 h-5 text-cyan-400" /> الإعدادات</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {unlocked ? <Unlock className="w-5 h-5 text-emerald-400" /> : <Lock className="w-5 h-5 text-amber-400" />}
              <div>
                <p className="font-semibold">حالة عرض التفاصيل المالية</p>
                <p className="text-sm text-slate-400">{unlocked ? 'مفتوح حالياً' : 'مقفل'}</p>
              </div>
            </div>
            <button onClick={toggleUnlock} className={`px-4 py-2 rounded-xl font-semibold text-sm ${unlocked ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {unlocked ? 'إقفال' : 'فتح'}
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-400">{hasPassword ? 'تغيير كلمة سر التفاصيل المالية' : 'تعيين كلمة سر التفاصيل المالية'}</h4>
            {hasPassword && (
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} placeholder="كلمة السر الحالية" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input-field pr-10 pl-10" />
              </div>
            )}
            <div className="relative">
              <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type={showPassword ? 'text' : 'password'} placeholder="كلمة السر الجديدة" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field pr-10 pl-10" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type={showPassword ? 'text' : 'password'} placeholder="تأكيد كلمة السر" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field pr-10" />
            </div>
            {message && (
              <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${isError ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {isError ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />} {message}
              </div>
            )}
            <button onClick={handleSetPassword} className="btn-primary w-full flex items-center justify-center gap-2"><Save className="w-5 h-5" /> حفظ كلمة السر</button>
            <p className="text-xs text-slate-500 text-center">تُستخدم كلمة السر لإظهار التكلفة وصافي الربح في جميع الشاشات</p>
          </div>
        </div>
      </div>
    </div>
  );
}
