import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dpjicbqujyydwbgbndim.supabase.co';

const supabaseServiceKey =
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwamljYnF1anl5ZHdiZ2JuZGltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDk4ODk4NywiZXhwIjoyMTEwNTY0OTg3fQ.ElhkScjj3FA1ijpWLNUlqaN3yelVLL4ooxUv4TUrsWk';

/**
 * Supabase Admin Client using Service Role Key.
 * Used exclusively for:
 * 1. Admin user creation with email_confirm: true (completely eliminates email rate limit errors)
 * 2. Unrestricted user role and company profile provisioning
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

