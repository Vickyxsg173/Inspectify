import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AccountType = 'personal' | 'company' | null;

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  account_type: 'personal' | 'company';
  company_name?: string;
  contact_person?: string;
  phone?: string;
}

interface AuthContextType {
  user: any;
  session: any;
  accountType: AccountType;
  companyId: string | null;
  companyName: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  signUp: (data: RegisterData) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const HOST_IP = process.env.EXPO_PUBLIC_HOST_IP || '192.168.29.213';
const BACKEND_URL = `http://${HOST_IP}:8000`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = await res.json();
        const accType = profile.account_type as AccountType;
        setAccountType(accType);
        setCompanyId(profile.company_id || null);
        setCompanyName(profile.company_name || null);
        await AsyncStorage.setItem('inspectify_account_type', profile.account_type || '');
        await AsyncStorage.setItem('inspectify_company_id', profile.company_id || '');
      } else {
        // Fallback to local storage if network is unreachable
        const cachedType = await AsyncStorage.getItem('inspectify_account_type');
        const cachedCompId = await AsyncStorage.getItem('inspectify_company_id');
        if (cachedType) setAccountType(cachedType as AccountType);
        if (cachedCompId) setCompanyId(cachedCompId);
      }
    } catch (e) {
      console.warn('Could not fetch profile from backend, using cache:', e);
      const cachedType = await AsyncStorage.getItem('inspectify_account_type');
      const cachedCompId = await AsyncStorage.getItem('inspectify_company_id');
      if (cachedType) setAccountType(cachedType as AccountType);
      if (cachedCompId) setCompanyId(cachedCompId);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        fetchProfile(session.access_token).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        await fetchProfile(session.access_token);
      } else {
        setAccountType(null);
        setCompanyId(null);
        setCompanyName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.session) {
        await fetchProfile(data.session.access_token);
      }
      return { error };
    } catch (e: any) {
      return { error: { message: e.message || 'Sign in failed' } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccountType(null);
    setCompanyId(null);
    setCompanyName(null);
    await AsyncStorage.multiRemove(['inspectify_account_type', 'inspectify_company_id']);
  };

  const signUp = async (registerData: RegisterData) => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      });
      if (!res.ok) {
        const err = await res.json();
        return { error: { message: err.detail || 'Registration failed' } };
      }
      // Now sign in with Supabase directly
      const { error } = await signIn(registerData.email, registerData.password);
      return { error };
    } catch (e: any) {
      return { error: { message: `Network error — make sure backend is running at ${BACKEND_URL}` } };
    }
  };

  const refreshProfile = async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        accountType,
        companyId,
        companyName,
        isLoading,
        signIn,
        signOut,
        signUp,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
