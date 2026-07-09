import { useState } from 'react';
import { Lock, X, Eye, EyeOff } from 'lucide-react';
import { verifyPassword } from '../lib/financial';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PasswordPrompt({ onSuccess, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true); setError('');
    const result = await verifyPassword(password);
    setLoading(false);
    if (result.success) onSuccess();
    else setError(result.error || 'خطأ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="glass-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-lg font-bold flex items-center gap-2"><Lock className="w-5 h-5 text-amber-400" /> عرض التفاصيل المالية</h3>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-400">أدخل كلمة السر لعرض التكلفة وصافي الربح</p>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="كلمة السر"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="input-field pr-10 pl-10"
              autoFocus
            />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}
