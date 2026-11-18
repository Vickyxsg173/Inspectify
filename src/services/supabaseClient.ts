import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dpjicbqujyydwbgbndim.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwamljYnF1anl5ZHdiZ2JuZGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5ODg5ODcsImV4cCI6MjExMDU2NDk4N30.UC2TlEVOJz_ckuAwDXDF_L9bhR3T6HM0FeX9gUDkamg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

