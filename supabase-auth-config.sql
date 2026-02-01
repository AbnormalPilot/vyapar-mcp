-- Supabase Auth Configuration for Vyapar
-- Run these in Supabase Dashboard > Authentication > Settings

-- ============ DISABLE EMAIL CONFIRMATION ============
-- Go to: Dashboard > Authentication > Providers > Email
-- Set "Confirm email" to OFF

-- ============ ENABLE GOOGLE AUTH ============
-- Go to: Dashboard > Authentication > Providers > Google
-- Enable Google provider
-- Add your Google OAuth credentials:
--   - Client ID (from Google Cloud Console)
--   - Client Secret (from Google Cloud Console)

-- ============ CONFIGURE REDIRECT URLS ============
-- Go to: Dashboard > Authentication > URL Configuration
-- Add Site URL: your-app://auth/callback
-- Add Redirect URLs:
--   - exp://localhost:8081/--/auth/callback (for Expo Go development)
--   - your-app://auth/callback (for production)

-- ============ JWT SETTINGS ============
-- Go to: Dashboard > Settings > API
-- Copy:
--   - API URL (SUPABASE_URL)
--   - service_role key (SUPABASE_SERVICE_KEY) - for MCP server
--   - anon key (EXPO_PUBLIC_SUPABASE_KEY) - for mobile app

-- ============ USER PROFILE TRIGGER ============
-- This trigger automatically creates a user profile when a new user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, language, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'en',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES FOR AUTHENTICATED USERS ============
-- Allow users to read and update their own data

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Products table policies
CREATE POLICY "Users can view own products" ON products
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" ON products
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" ON products
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" ON products
    FOR DELETE USING (auth.uid() = user_id);

-- Customers table policies
CREATE POLICY "Users can view own customers" ON customers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers" ON customers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers" ON customers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers" ON customers
    FOR DELETE USING (auth.uid() = user_id);

-- Invoices table policies
CREATE POLICY "Users can view own invoices" ON invoices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" ON invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" ON invoices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices" ON invoices
    FOR DELETE USING (auth.uid() = user_id);

-- Transactions table policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Expenses table policies
CREATE POLICY "Users can view own expenses" ON expenses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses" ON expenses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON expenses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON expenses
    FOR DELETE USING (auth.uid() = user_id);

-- Suppliers table policies
CREATE POLICY "Users can view own suppliers" ON suppliers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suppliers" ON suppliers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers" ON suppliers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers" ON suppliers
    FOR DELETE USING (auth.uid() = user_id);

-- Purchase orders table policies
CREATE POLICY "Users can view own purchase_orders" ON purchase_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase_orders" ON purchase_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchase_orders" ON purchase_orders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchase_orders" ON purchase_orders
    FOR DELETE USING (auth.uid() = user_id);
