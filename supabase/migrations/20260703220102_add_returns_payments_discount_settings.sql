/*
# Add returns, partial payments, discount, and settings

1. New Tables
- `settings` — single-row table for app-level config (financial password hash).
  - `id` (int, primary key, always 1)
  - `financial_password` (text, nullable) — hashed password protecting cost/profit views
  - `updated_at` (timestamptz)
- `payments` — partial payment records for invoices.
  - `id` (uuid, primary key)
  - `invoice_id` (uuid, FK to invoices, cascade delete)
  - `amount` (numeric, not null)
  - `note` (text, nullable)
  - `created_at` (timestamptz)

2. Modified Tables
- `invoices`:
  - `discount` (numeric, default 0) — discount amount applied after payment
  - `original_total` (numeric, default 0) — stores original total before discount for strikethrough display
- `invoice_items`:
  - `is_returned` (boolean, default false) — marks item as returned
  - `returned_at` (timestamptz, nullable) — when the return was recorded

3. Security
- RLS enabled on `settings` and `payments`.
- Anon + authenticated CRUD (single-tenant, no auth screen).

4. Notes
- `notes` column already exists on invoices — no change needed.
- `is_paid` on invoices becomes derived: paid when sum(payments) >= (total_amount - discount).
  We keep `is_paid` for backwards compat but the app will compute remaining balance from payments.
*/

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  financial_password text,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_payments" ON payments;
CREATE POLICY "anon_select_payments" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payments" ON payments;
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payments" ON payments;
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_payments" ON payments;
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE TO anon, authenticated USING (true);

-- Add columns to invoices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='discount') THEN
    ALTER TABLE invoices ADD COLUMN discount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='original_total') THEN
    ALTER TABLE invoices ADD COLUMN original_total numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add columns to invoice_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='is_returned') THEN
    ALTER TABLE invoice_items ADD COLUMN is_returned boolean NOT NULL DEFAULT false;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='returned_at') THEN
    ALTER TABLE invoice_items ADD COLUMN returned_at timestamptz;
  END IF;
END $$;
