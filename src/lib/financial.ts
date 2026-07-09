import { db } from './db';

const SESSION_KEY = 'fin_unlocked';

export async function getSettings(): Promise<{ id: number; financial_password: string | null; updated_at: string } | null> {
  const row = await db.from('settings').eq('id', 1).maybeSingle();
  if (row.error) return null;
  return row.data as { id: number; financial_password: string | null; updated_at: string } | null;
}

export async function setFinancialPassword(password: string): Promise<boolean> {
  const result = await db.from('settings').update({
    financial_password: password,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (result.error) return false;
  return true;
}

export async function changeFinancialPassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const settings = await getSettings();
  if (!settings) return { success: false, error: 'تعذر الوصول للإعدادات' };
  if (settings.financial_password && settings.financial_password !== oldPassword) {
    return { success: false, error: 'كلمة السر الحالية غير صحيحة' };
  }
  const ok = await setFinancialPassword(newPassword);
  if (!ok) return { success: false, error: 'فشل حفظ كلمة السر' };
  return { success: true };
}

export function isFinancialUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function setUnlocked(unlocked: boolean) {
  if (unlocked) sessionStorage.setItem(SESSION_KEY, 'true');
  else sessionStorage.removeItem(SESSION_KEY);
}

export async function verifyPassword(password: string): Promise<{ success: boolean; error?: string }> {
  const settings = await getSettings();
  if (!settings) return { success: false, error: 'تعذر الوصول للإعدادات' };
  if (!settings.financial_password) return { success: false, error: 'لم يتم تعيين كلمة سر بعد' };
  if (settings.financial_password !== password) return { success: false, error: 'كلمة السر غير صحيحة' };
  setUnlocked(true);
  return { success: true };
}

export function lockFinancial() {
  setUnlocked(false);
}

export async function hasPasswordSet(): Promise<boolean> {
  const settings = await getSettings();
  return !!(settings && settings.financial_password);
}
