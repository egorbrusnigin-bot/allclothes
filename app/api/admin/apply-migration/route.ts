import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST() {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
        { status: 503 }
      );
    }

    const sql = `
      ALTER TABLE sellers ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
      ALTER TABLE sellers ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false;
      ALTER TABLE sellers ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false;

      CREATE TABLE IF NOT EXISTS payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE,
        brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
        stripe_payout_id TEXT,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        stripe_payment_intent_id TEXT UNIQUE,
        stripe_transfer_id TEXT,
        amount DECIMAL(10,2) NOT NULL,
        platform_fee DECIMAL(10,2) NOT NULL,
        seller_amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'pending',
        seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
        brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_payouts_seller_id ON payouts(seller_id);
      CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
      CREATE INDEX IF NOT EXISTS idx_payments_seller_id ON payments(seller_id);
    `;

    // Execute SQL via Supabase REST API (rpc or direct SQL)
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    // If rpc/exec_sql doesn't exist, try the SQL endpoint
    if (!res.ok) {
      // Try via the Supabase Management API SQL endpoint
      const sqlRes = await fetch(`${supabaseUrl}/pg`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!sqlRes.ok) {
        return NextResponse.json({
          error: "Cannot execute SQL via API. Please run the migration manually in Supabase SQL Editor.",
          instructions: [
            "1. Go to your Supabase Dashboard",
            "2. Navigate to SQL Editor",
            "3. Paste the contents of supabase-migrations/002_stripe_connect.sql",
            "4. Click 'Run'",
          ],
          sql_file: "supabase-migrations/002_stripe_connect.sql",
        }, { status: 422 });
      }
    }

    return NextResponse.json({ success: true, message: "Migration applied successfully" });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    );
  }
}
