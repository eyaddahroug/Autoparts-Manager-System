import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import type { Part, Invoice, InvoiceItem } from './types';

const PART_COLUMNS = [
  'code', 'name', 'manufacturer', 'car_brand', 'car_model',
  'price', 'cost', 'quantity', 'min_quantity', 'category', 'origin'
];

const ARABIC_HEADERS: Record<string, string> = {
  code: 'الكود',
  name: 'اسم القطعة',
  manufacturer: 'المصنع',
  car_brand: 'ماركة السيارة',
  car_model: 'موديل السيارة',
  price: 'السعر',
  cost: 'التكلفة',
  quantity: 'الكمية',
  min_quantity: 'حد التنبيه',
  category: 'التصنيف',
  origin: 'المنشأ',
};

const ENGLISH_TO_KEY: Record<string, string> = {};
Object.entries(ARABIC_HEADERS).forEach(([key, val]) => {
  ENGLISH_TO_KEY[val] = key;
  ENGLISH_TO_KEY[key] = key;
});

export function downloadPartsTemplate() {
  const sampleData = [
    {
      'الكود': 'HY-001',
      'اسم القطعة': 'فلتر زيت',
      'المصنع': 'Hyundai OEM',
      'ماركة السيارة': 'هيونداي',
      'موديل السيارة': 'إلنترا, سوناتا',
      'السعر': 45,
      'التكلفة': 30,
      'الكمية': 50,
      'حد التنبيه': 10,
      'التصنيف': 'فلاتر',
      'المنشأ': 'كوري',
    },
    {
      'الكود': 'TY-001',
      'اسم القطعة': 'فلتر هواء',
      'المصنع': 'Toyota OEM',
      'ماركة السيارة': 'تويوتا',
      'موديل السيارة': 'كامري, كورولا',
      'السعر': 55,
      'التكلفة': 38,
      'الكمية': 30,
      'حد التنبيه': 8,
      'التصنيف': 'فلاتر',
      'المنشأ': 'ياباني',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 25 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'قطع الغيار');
  XLSX.writeFile(wb, 'نموذج_قطع_الغيار.xlsx');
}

export async function exportPartsToExcel() {
  const { data, error } = await supabase.from('parts').select('*').order('code');
  if (error) throw error;

  const rows = (data || []).map((p: Part) => ({
    'الكود': p.code,
    'اسم القطعة': p.name,
    'المصنع': p.manufacturer,
    'ماركة السيارة': p.car_brand,
    'موديل السيارة': p.car_model,
    'السعر': p.price,
    'التكلفة': p.cost,
    'الكمية': p.quantity,
    'حد التنبيه': p.min_quantity,
    'التصنيف': p.category,
    'المنشأ': p.origin,
  }));

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  ws['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 25 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'قطع الغيار');
  XLSX.writeFile(wb, `قطع_الغيار_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function importPartsFromExcel(file: File): Promise<{ added: number; updated: number; errors: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  let added = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const partData: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(row)) {
      const mappedKey = ENGLISH_TO_KEY[key.trim()] || key.trim().toLowerCase();
      if (PART_COLUMNS.includes(mappedKey)) {
        partData[mappedKey] = val;
      }
    }

    if (!partData.code || !partData.name) {
      errors.push(`الصف ${i + 2}: الكود واسم القطعة مطلوبان`);
      continue;
    }

    const code = String(partData.code).trim();
    const { data: existing } = await supabase
      .from('parts')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    const payload = {
      code,
      name: String(partData.name).trim(),
      manufacturer: String(partData.manufacturer || '').trim(),
      car_brand: String(partData.car_brand || '').trim(),
      car_model: String(partData.car_model || '').trim(),
      price: Number(partData.price) || 0,
      cost: Number(partData.cost) || 0,
      quantity: Number(partData.quantity) || 0,
      min_quantity: Number(partData.min_quantity) || 5,
      category: String(partData.category || '').trim(),
      origin: String(partData.origin || '').trim(),
    };

    if (existing) {
      const { error } = await supabase.from('parts').update(payload).eq('id', existing.id);
      if (error) errors.push(`الصف ${i + 2} (${code}): ${error.message}`);
      else updated++;
    } else {
      const { error } = await supabase.from('parts').insert(payload);
      if (error) errors.push(`الصف ${i + 2} (${code}): ${error.message}`);
      else added++;
    }
  }

  return { added, updated, errors };
}

export async function exportInvoicesToExcel() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .order('created_at', { ascending: false });

  const itemMap: Record<string, InvoiceItem[]> = {};
  (items || []).forEach((item: InvoiceItem) => {
    if (!itemMap[item.invoice_id]) itemMap[item.invoice_id] = [];
    itemMap[item.invoice_id].push(item);
  });

  const flatRows: Record<string, unknown>[] = [];
  (invoices || []).forEach((inv: Invoice) => {
    const invItems = itemMap[inv.id] || [];
    if (invItems.length === 0) {
      flatRows.push({
        'رقم الفاتورة': inv.invoice_number,
        'التاريخ': new Date(inv.created_at).toLocaleDateString('ar-EG'),
        'اسم المشتري': inv.buyer_name,
        'ماركة السيارة': inv.car_brand,
        'موديل السيارة': inv.car_model,
        'كود القطعة': '',
        'اسم القطعة': '',
        'المصنع': '',
        'الكمية': '',
        'سعر الوحدة': '',
        'الإجمالي': inv.total_amount,
        'الحالة': inv.is_paid ? 'تم الدفع' : 'لم يتم الدفع',
        'ملاحظات': inv.notes,
      });
    } else {
      invItems.forEach((item) => {
        flatRows.push({
          'رقم الفاتورة': inv.invoice_number,
          'التاريخ': new Date(inv.created_at).toLocaleDateString('ar-EG'),
          'اسم المشتري': inv.buyer_name,
          'ماركة السيارة': inv.car_brand,
          'موديل السيارة': inv.car_model,
          'كود القطعة': item.part_code,
          'اسم القطعة': item.part_name,
          'المصنع': item.manufacturer,
          'الكمية': item.quantity,
          'سعر الوحدة': item.unit_price,
          'الإجمالي': inv.total_amount,
          'الحالة': inv.is_paid ? 'تم الدفع' : 'لم يتم الدفع',
          'ملاحظات': inv.notes,
        });
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(flatRows.length ? flatRows : [{}]);
  ws['!cols'] = [
    { wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الفواتير');
  XLSX.writeFile(wb, `الفواتير_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
