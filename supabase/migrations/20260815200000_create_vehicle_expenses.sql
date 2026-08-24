-- Create vehicle_expenses table
CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id),
  agent_id uuid NOT NULL REFERENCES user_profiles(id),
  expense_category_id uuid NOT NULL REFERENCES expense_categories(id),
  amount numeric NOT NULL,
  expense_date date NOT NULL,
  description text,
  merchant_name text,
  invoice_available boolean DEFAULT false,
  notes text,
  status travel_expense_status_type DEFAULT 'SUBMITTED',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- Policies for vehicle_expenses
DROP POLICY IF EXISTS "Agents can view their own vehicle expenses" ON vehicle_expenses;
CREATE POLICY "Agents can view their own vehicle expenses" ON vehicle_expenses
  FOR SELECT USING (agent_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Agents can insert their own vehicle expenses" ON vehicle_expenses;
CREATE POLICY "Agents can insert their own vehicle expenses" ON vehicle_expenses
  FOR INSERT WITH CHECK (agent_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Agents can update their own SUBMITTED vehicle expenses" ON vehicle_expenses;
CREATE POLICY "Agents can update their own SUBMITTED vehicle expenses" ON vehicle_expenses
  FOR UPDATE USING (agent_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) AND status = 'SUBMITTED');

DROP POLICY IF EXISTS "Admins have full access to vehicle expenses" ON vehicle_expenses;
CREATE POLICY "Admins have full access to vehicle expenses" ON vehicle_expenses
  FOR ALL USING (
    (SELECT user_type FROM public.user_profiles WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

-- Create vehicle_expense_attachments table
CREATE TABLE IF NOT EXISTS vehicle_expense_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES vehicle_expenses(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  attachment_type expense_attachment_type NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  uploaded_by uuid REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE vehicle_expense_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for vehicle_expense_attachments
DROP POLICY IF EXISTS "Agents can view their own vehicle expense attachments" ON vehicle_expense_attachments;
CREATE POLICY "Agents can view their own vehicle expense attachments" ON vehicle_expense_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vehicle_expenses
      WHERE id = vehicle_expense_attachments.expense_id AND agent_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Agents can insert attachments for their own expenses" ON vehicle_expense_attachments;
CREATE POLICY "Agents can insert attachments for their own expenses" ON vehicle_expense_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_expenses
      WHERE id = expense_id AND agent_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Agents can delete attachments for their own SUBMITTED expenses" ON vehicle_expense_attachments;
CREATE POLICY "Agents can delete attachments for their own SUBMITTED expenses" ON vehicle_expense_attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vehicle_expenses
      WHERE id = vehicle_expense_attachments.expense_id AND agent_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid()) AND status = 'SUBMITTED'
    )
  );

DROP POLICY IF EXISTS "Admins have full access to vehicle expense attachments" ON vehicle_expense_attachments;
CREATE POLICY "Admins have full access to vehicle expense attachments" ON vehicle_expense_attachments
  FOR ALL USING (
    (SELECT user_type FROM public.user_profiles WHERE auth_user_id = auth.uid()) = 'ADMIN'
  );

