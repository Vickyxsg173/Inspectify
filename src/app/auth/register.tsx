import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { BACKEND_URL } from '@/constants/api';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen() {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<'personal' | 'company'>('personal');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Required Fields', 'Please complete all required fields.');
      return;
    }
    if (accountType === 'company' && !companyName.trim()) {
      Alert.alert('Required Fields', 'Please enter your company name.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    let registeredViaBackend = false;
    try {
      // 1. Try backend registration endpoint (creates user in Supabase Auth + records in public.users & companies)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          account_type: accountType,
          company_name: companyName.trim() || undefined,
          contact_person: contactPerson.trim() || fullName.trim(),
          phone: phone.trim() || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        registeredViaBackend = true;
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.detail && typeof err.detail === 'string' && err.detail.includes('already registered')) {
          setLoading(false);
          Alert.alert('Account Exists', 'This email is already registered. Please sign in.', [
            { text: 'Go to Sign In', onPress: () => router.replace('/auth/login' as any) },
          ]);
          return;
        }
      }
    } catch (networkErr) {
      console.warn('Backend unavailable, attempting direct Supabase auth:', networkErr);
    }

    // 2. If backend was unreachable or signup needed direct fallback
    if (!registeredViaBackend) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            account_type: accountType,
            company_name: companyName.trim() || undefined,
          },
        },
      });

      if (signUpErr) {
        setLoading(false);
        Alert.alert('Registration Failed', signUpErr.message);
        return;
      }
    }

    // 3. Immediately sign in with the new credentials to establish session
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInErr) {
      Alert.alert(
        'Account Created',
        'Your account has been registered. Please sign in with your email and password.',
        [{ text: 'Sign In', onPress: () => router.replace('/auth/login' as any) }]
      );
      return;
    }

    // Session is active! Refresh profile and route to main screen
    await refreshProfile();
    router.replace('/(tabs)');
  };

  if (step === 1) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950">
        <View className="flex-1 justify-center px-6 py-6">
          <View className="mb-8">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-3 h-3 rounded-full bg-red-500" />
              <Text className="text-red-500 font-bold uppercase tracking-widest text-xs">Inspectify Access</Text>
            </View>
            <Text className="text-3xl font-extrabold text-white mb-2">Create Account</Text>
            <Text className="text-zinc-400 text-sm">Select the account type that matches your workflow to enter.</Text>
          </View>

          {/* Option 1: Personal User */}
          <TouchableOpacity
            className={`rounded-2xl p-5 mb-4 border-2 ${
              accountType === 'personal' ? 'border-red-500 bg-red-500/10' : 'border-zinc-800 bg-zinc-900'
            }`}
            onPress={() => setAccountType('personal')}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-3 mb-2">
              <View className={`w-10 h-10 rounded-xl items-center justify-center ${accountType === 'personal' ? 'bg-red-500' : 'bg-zinc-800'}`}>
                <Ionicons name="person" size={20} color="white" />
              </View>
              <View>
                <Text className="text-white text-lg font-bold">Personal User</Text>
                <Text className="text-zinc-400 text-xs">Instant QC & Single Package Inspection</Text>
              </View>
            </View>
            <Text className="text-zinc-400 text-xs leading-relaxed mt-1">
              Access packaging damage scanning, micro-scratch screen inspection, and instant damage risk assessment.
            </Text>
          </TouchableOpacity>

          {/* Option 2: Company Account */}
          <TouchableOpacity
            className={`rounded-2xl p-5 border-2 ${
              accountType === 'company' ? 'border-red-500 bg-red-500/10' : 'border-zinc-800 bg-zinc-900'
            }`}
            onPress={() => setAccountType('company')}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-3 mb-2">
              <View className={`w-10 h-10 rounded-xl items-center justify-center ${accountType === 'company' ? 'bg-red-500' : 'bg-zinc-800'}`}>
                <MaterialCommunityIcons name="office-building" size={22} color="white" />
              </View>
              <View>
                <Text className="text-white text-lg font-bold">Company / Enterprise</Text>
                <Text className="text-zinc-400 text-xs">Multi-Box Shipments & Fleet Analytics</Text>
              </View>
            </View>
            <Text className="text-zinc-400 text-xs leading-relaxed mt-1">
              Manage multi-package shipments, aggregate batch damage risk, route risk analytics, and dispatch weather windows.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-red-500 active:bg-red-600 rounded-xl py-4 items-center mt-8 shadow-lg shadow-red-500/20"
            onPress={() => setStep(2)}
          >
            <Text className="text-white font-bold text-base">Continue</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6 items-center">
            <Text className="text-zinc-400 text-sm">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login' as any)}>
              <Text className="text-red-500 font-bold text-sm">Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="px-6 py-12">
            <TouchableOpacity
              onPress={() => setStep(1)}
              className="flex-row items-center mb-6 bg-zinc-900 self-start px-3 py-1.5 rounded-full border border-zinc-800"
            >
              <Ionicons name="arrow-back" size={18} color="#A1A1AA" />
              <Text className="text-zinc-400 text-sm ml-1 font-medium">Back to Account Type</Text>
            </TouchableOpacity>

            <View className="mb-6">
              <Text className="text-xs font-bold uppercase tracking-widest text-red-500 mb-1">
                Step 2 of 2 · {accountType === 'company' ? 'Company Account' : 'Personal Account'}
              </Text>
              <Text className="text-3xl font-extrabold text-white mb-1">Complete Profile</Text>
              <Text className="text-zinc-400 text-sm">Fill in your information to set up your account.</Text>
            </View>

            <View className="gap-3.5">
              <View>
                <Text className="text-zinc-300 text-xs font-semibold mb-1 uppercase tracking-wider">Full Name *</Text>
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-base"
                  placeholder="Jane Doe"
                  placeholderTextColor="#71717A"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View>
                <Text className="text-zinc-300 text-xs font-semibold mb-1 uppercase tracking-wider">Email Address *</Text>
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-base"
                  placeholder="jane@example.com"
                  placeholderTextColor="#71717A"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View>
                <Text className="text-zinc-300 text-xs font-semibold mb-1 uppercase tracking-wider">Password *</Text>
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-base"
                  placeholder="At least 6 characters"
                  placeholderTextColor="#71717A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {accountType === 'company' && (
                <>
                  <View className="mt-2 pt-2 border-t border-zinc-800">
                    <Text className="text-zinc-300 text-xs font-semibold mb-1 uppercase tracking-wider">Company Name *</Text>
                    <TextInput
                      className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-base"
                      placeholder="Acme Logistics Corp."
                      placeholderTextColor="#71717A"
                      value={companyName}
                      onChangeText={setCompanyName}
                    />
                  </View>

                  <View>
                    <Text className="text-zinc-300 text-xs font-semibold mb-1 uppercase tracking-wider">Contact Person</Text>
                    <TextInput
                      className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-base"
                      placeholder="Logistics Operations Lead"
                      placeholderTextColor="#71717A"
                      value={contactPerson}
                      onChangeText={setContactPerson}
                    />
                  </View>

                  <View>
                    <Text className="text-zinc-300 text-xs font-semibold mb-1 uppercase tracking-wider">Phone Number</Text>
                    <TextInput
                      className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-base"
                      placeholder="+91 98765 43210"
                      placeholderTextColor="#71717A"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                className="bg-red-500 active:bg-red-600 rounded-xl py-4 items-center mt-4 shadow-lg shadow-red-500/20"
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">Complete Registration</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
