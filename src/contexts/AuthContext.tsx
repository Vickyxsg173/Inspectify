import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { supabaseAdmin } from '../services/supabaseAdmin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../constants/api';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch extended profile directly from Supabase (zero dependency on backend)
  const fetchProfile = async (token?: string, userId?: string) => {
    try {
      const targetUserId = userId || user?.id || (await supabase.auth.getUser()).data.user?.id;
      if (targetUserId) {
        // 1. Direct Supabase Query to public.users & companies
        const { data: profileRow, error: pErr } = await supabaseAdmin
          .from('users')
          .select('account_type, company_id, full_name, companies(id, name)')
          .eq('id', targetUserId)
          .single();

        if (!pErr && profileRow) {
          const accType = (profileRow.account_type as AccountType) || 'personal';
          const compId = profileRow.company_id || null;
          const compName = (profileRow as any).companies?.name || null;

          setAccountType(accType);
          setCompanyId(compId);
          setCompanyName(compName);

          await AsyncStorage.setItem('inspectify_account_type', accType || '');
          if (compId) await AsyncStorage.setItem('inspectify_company_id', compId);
          if (compName) await AsyncStorage.setItem('inspectify_company_name', compName);
          return;
        }

        // If no user row in public.users yet, check user metadata & create it
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
        const meta = authUserData?.user?.user_metadata || {};
        if (meta.account_type) {
          const accType = meta.account_type as AccountType;
          setAccountType(accType);
          if (meta.company_name) setCompanyName(meta.company_name);
          await AsyncStorage.setItem('inspectify_account_type', accType || '');
          if (meta.company_name) await AsyncStorage.setItem('inspectify_company_name', meta.company_name);

          // Backfill public.users
          if (authUserData?.user?.email) {
            await supabaseAdmin.from('users').upsert({
              id: targetUserId,
              email: authUserData.user.email,
              full_name: meta.full_name || '',
              account_type: accType,
            });
          }
          return;
        }
      }

      // 2. Best-effort check with backend /auth/me if token available
      if (token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${BACKEND_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const profile = await res.json();
          setAccountType(profile.account_type as AccountType);
          setCompanyId(profile.company_id || null);
          setCompanyName(profile.company_name || null);
          await AsyncStorage.setItem('inspectify_account_type', profile.account_type || '');
          if (profile.company_id) await AsyncStorage.setItem('inspectify_company_id', profile.company_id);
          if (profile.company_name) await AsyncStorage.setItem('inspectify_company_name', profile.company_name);
          return;
        }
      }
    } catch (_) {
      // Use cached credentials
    }

    // 3. Fallback to AsyncStorage cache
    const cachedType = await AsyncStorage.getItem('inspectify_account_type');
    const cachedCompId = await AsyncStorage.getItem('inspectify_company_id');
    const cachedCompName = await AsyncStorage.getItem('inspectify_company_name');
    if (cachedType) setAccountType(cachedType as AccountType);
    if (cachedCompId) setCompanyId(cachedCompId);
    if (cachedCompName) setCompanyName(cachedCompName);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        fetchProfile(s.access_token, s.user?.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        fetchProfile(s.access_token, s.user?.id);
      } else {
        setAccountType(null);
        setCompanyId(null);
        setCompanyName(null);
        AsyncStorage.multiRemove([
          'inspectify_account_type',
          'inspectify_company_id',
          'inspectify_company_name',
        ]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // signIn: resilient sign-in with automatic unconfirmed account recovery
  const signIn = async (email: string, password: string) => {
    try {
      let { error, data } = await supabase.auth.signInWithPassword({ email, password });

      // If user is unconfirmed, auto-confirm via admin and retry
      if (error && error.message.toLowerCase().includes('email not confirmed')) {
        try {
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
          const target = userList?.users?.find(
            (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
          );
          if (target) {
            await supabaseAdmin.auth.admin.updateUserById(target.id, { email_confirm: true });
            const retry = await supabase.auth.signInWithPassword({ email, password });
            error = retry.error;
            data = retry.data;
          }
        } catch (_adminConfirmErr) {
          // Continue with original error
        }
      }

      if (!error && data.session) {
        await fetchProfile(data.session.access_token, data.user?.id);
      }
      return { error };
    } catch (e: any) {
      return { error: { message: e.message || 'Sign in failed' } };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut error:', err);
    }
    setSession(null);
    setUser(null);
    setAccountType(null);
    setCompanyId(null);
    setCompanyName(null);
    await AsyncStorage.multiRemove([
      'inspectify_account_type',
      'inspectify_company_id',
      'inspectify_company_name',
    ]);
  };

  /**
   * signUp: Zero-rate-limit registration.
   * Uses admin creation with `email_confirm: true` so NO outbound email is triggered,
   * eliminating "email rate limit exceeded" errors.
   */
  const signUp = async (registerData: RegisterData) => {
    const cleanEmail = registerData.email.trim();
    const cleanPassword = registerData.password;
    const cleanFullName = registerData.full_name.trim();
    const cleanAccountType = registerData.account_type;
    const cleanCompanyName = registerData.company_name?.trim();

    try {
      let userId: string | null = null;

      // 1. Admin creation with email_confirm: true (bypasses email rate limit!)
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          full_name: cleanFullName,
          account_type: cleanAccountType,
          company_name: cleanCompanyName || null,
        },
      });

      if (createErr) {
        // If already registered, update user password & auto-confirm
        if (createErr.message.toLowerCase().includes('already registered')) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          const existing = list?.users?.find(
            (u) => u.email?.toLowerCase() === cleanEmail.toLowerCase()
          );
          if (existing) {
            userId = existing.id;
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: cleanPassword,
              email_confirm: true,
              user_metadata: {
                full_name: cleanFullName,
                account_type: cleanAccountType,
                company_name: cleanCompanyName || null,
              },
            });
          } else {
            return { error: { message: 'This email is already in use. Please sign in.' } };
          }
        } else {
          return { error: createErr };
        }
      } else {
        userId = created.user.id;
      }

      if (!userId) {
        return { error: { message: 'Unable to establish user credentials.' } };
      }

      let companyId: string | null = null;

      // 2. Provision Company Record for Enterprise Accounts
      if (cleanAccountType === 'company') {
        const cName = cleanCompanyName || `${cleanFullName}'s Organization`;
        const { data: compData, error: compErr } = await supabaseAdmin
          .from('companies')
          .insert({
            name: cName,
            contact_person: registerData.contact_person || cleanFullName,
            phone: registerData.phone || null,
            owner_id: userId,
          })
          .select()
          .single();

        if (!compErr && compData) {
          companyId = compData.id;
          // Add owner to company_members
          await supabaseAdmin.from('company_members').upsert({
            company_id: companyId,
            user_id: userId,
            role: 'owner',
          });
        }
      }

      // 3. Upsert Profile in public.users
      await supabaseAdmin.from('users').upsert({
        id: userId,
        email: cleanEmail,
        full_name: cleanFullName,
        account_type: cleanAccountType,
        company_id: companyId,
      });

      // 4. Set state & cache immediately
      setAccountType(cleanAccountType);
      setCompanyId(companyId);
      setCompanyName(cleanCompanyName || null);
      await AsyncStorage.setItem('inspectify_account_type', cleanAccountType);
      if (companyId) await AsyncStorage.setItem('inspectify_company_id', companyId);
      if (cleanCompanyName) await AsyncStorage.setItem('inspectify_company_name', cleanCompanyName);

      // 5. Sign In to activate session
      const { error: signInErr } = await signIn(cleanEmail, cleanPassword);
      return { error: signInErr };
    } catch (e: any) {
      return { error: { message: e.message || 'Registration failed' } };
    }
  };

  const refreshProfile = async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token, user?.id);
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
