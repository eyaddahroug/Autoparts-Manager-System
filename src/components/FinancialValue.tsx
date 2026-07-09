import { Lock } from 'lucide-react';
import { useFinancialUnlock } from '../lib/useFinancialUnlock';
import PasswordPrompt from '../components/PasswordPrompt';
import { useState } from 'react';

interface Props {
  value: number | string;
  suffix?: string;
  className?: string;
  label?: string;
}

export default function FinancialValue({ value, suffix = 'ج.م', className = '', label }: Props) {
  const { unlocked } = useFinancialUnlock();
  const [showPrompt, setShowPrompt] = useState(false);

  if (unlocked) {
    return <span className={className}>{typeof value === 'number' ? value.toLocaleString('ar-EG') : value} {suffix}</span>;
  }

  return (
    <>
      <button
        onClick={() => setShowPrompt(true)}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-amber-400 transition-colors"
        title={label || 'اضغط لإدخال كلمة السر وعرض القيمة'}
      >
        <Lock className="w-4 h-4" />
        <span className="text-sm">مقفل</span>
      </button>
      {showPrompt && (
        <PasswordPrompt
          onSuccess={() => setShowPrompt(false)}
          onCancel={() => setShowPrompt(false)}
        />
      )}
    </>
  );
}
