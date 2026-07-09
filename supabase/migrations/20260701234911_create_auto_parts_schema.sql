/*
# Auto Parts Store Management System Schema

## Overview
Complete schema for a Korean & Japanese auto parts store management system.
Supports parts inventory, electronic invoicing, Excel import/export, deep search,
low-stock alerts, and monthly profit/sales analytics.

## Tables

### parts
- `id` (uuid, PK) — unique identifier
- `code` (text, unique) — part code/SKU
- `name` (text) — part name (Arabic)
- `manufacturer` (text) — manufacturer/brand
- `car_brand` (text) — car brand (e.g. Hyundai, Toyota)
- `car_model` (text) — car model(s) that use this part
- `price` (numeric) — selling price
- `cost` (numeric, default 0) — purchase cost for profit calculation
- `quantity` (int) — available stock quantity
- `min_quantity` (int, default 5) — low-stock threshold for alerts
- `category` (text) — part category
- `origin` (text) — Korean / Japanese / etc.
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### invoices
- `id` (uuid, PK)
- `invoice_number` (text, unique) — auto-generated invoice number
- `buyer_name` (text) — customer/buyer name
- `car_brand` (text) — car brand for this invoice
- `car_model` (text) — car model
- `total_amount` (numeric) — total invoice amount
- `total_cost` (numeric) — total cost for profit calc
- `is_paid` (boolean, default false) — paid / unpaid status
- `notes` (text) — optional notes
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### invoice_items
- `id` (uuid, PK)
- `invoice_id` (uuid, FK → invoices)
- `part_id` (uuid, FK → parts)
- `part_code` (text) — snapshot of part code at time of sale
- `part_name` (text) — snapshot of part name
- `manufacturer` (text) — snapshot
- `car_brand` (text) — snapshot
- `quantity` (int) — quantity sold
- `unit_price` (numeric) — price per unit at time of sale
- `unit_cost` (numeric) — cost per unit at time of sale
- `subtotal` (numeric) — quantity * unit_price

## Security
- Single-tenant app (no auth). RLS enabled on all tables.
- Policies allow anon + authenticated full CRUD (data is intentionally shared).
*/

-- Parts table
CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  manufacturer text DEFAULT '',
  car_brand text DEFAULT '',
  car_model text DEFAULT '',
  price numeric(12,2) NOT NULL DEFAULT 0,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 5,
  category text DEFAULT '',
  origin text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_parts" ON parts;
CREATE POLICY "anon_select_parts" ON parts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_parts" ON parts;
CREATE POLICY "anon_insert_parts" ON parts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_parts" ON parts;
CREATE POLICY "anon_update_parts" ON parts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_parts" ON parts;
CREATE POLICY "anon_delete_parts" ON parts FOR DELETE
  TO anon, authenticated USING (true);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  buyer_name text DEFAULT '',
  car_brand text DEFAULT '',
  car_model text DEFAULT '',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
CREATE POLICY "anon_select_invoices" ON invoices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
CREATE POLICY "anon_insert_invoices" ON invoices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
CREATE POLICY "anon_update_invoices" ON invoices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "anon_delete_invoices" ON invoices FOR DELETE
  TO anon, authenticated USING (true);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  part_id uuid REFERENCES parts(id) ON DELETE SET NULL,
  part_code text NOT NULL,
  part_name text NOT NULL,
  manufacturer text DEFAULT '',
  car_brand text DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invoice_items" ON invoice_items;
CREATE POLICY "anon_select_invoice_items" ON invoice_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_invoice_items" ON invoice_items;
CREATE POLICY "anon_insert_invoice_items" ON invoice_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_invoice_items" ON invoice_items;
CREATE POLICY "anon_update_invoice_items" ON invoice_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_invoice_items" ON invoice_items;
CREATE POLICY "anon_delete_invoice_items" ON invoice_items FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_parts_code ON parts(code);
CREATE INDEX IF NOT EXISTS idx_parts_name ON parts(name);
CREATE INDEX IF NOT EXISTS idx_parts_car_brand ON parts(car_brand);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_is_paid ON invoices(is_paid);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_part_id ON invoice_items(part_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_parts_updated_at ON parts;
CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON parts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
