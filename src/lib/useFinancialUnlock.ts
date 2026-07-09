import { useState, useEffect, useCallback } from 'react';
import { isFinancialUnlocked, setUnlocked } from './financial';

export function useFinancialUnlock() {
  const [unlocked, setUnlockedState] = useState(isFinancialUnlocked());

  useEffect(() => {
    const handler = () => setUnlockedState(isFinancialUnlocked());
    window.addEventListener('storage', handler);
    window.addEventListener('fin-unlock-changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('fin-unlock-changed', handler);
    };
  }, []);

  const unlock = useCallback(() => {
    setUnlocked(true);
    window.dispatchEvent(new Event('fin-unlock-changed'));
  }, []);

  const lock = useCallback(() => {
    setUnlocked(false);
    window.dispatchEvent(new Event('fin-unlock-changed'));
  }, []);

  return { unlocked, unlock, lock };
}
