import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message || 'Invalid email or password.');
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 py-12">
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-row items-center mb-8 bg-zinc-900 self-start px-3 py-1.5 rounded-full border border-zinc-800"
            >
              <Ionicons name="arrow-back" size={18} color="#A1A1AA" />
              <Text className="text-zinc-400 text-sm ml-1 font-medium">Back</Text>
            </TouchableOpacity>

            <View className="mb-8">
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-3 h-3 rounded-full bg-red-500" />
                <Text className="text-red-500 font-bold uppercase tracking-widest text-xs">Inspectify Platform</Text>
              </View>
              <Text className="text-3xl font-extrabold text-white mb-2">Welcome Back</Text>
              <Text className="text-zinc-400 text-sm">Sign in to access AI logistics predictions and damage tracking.</Text>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-zinc-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">Email Address</Text>
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3.5 text-base"
                  placeholder="name@company.com"
                  placeholderTextColor="#71717A"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View>
                <Text className="text-zinc-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">Password</Text>
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3.5 text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#71717A"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                className="bg-red-500 active:bg-red-600 rounded-xl py-4 items-center mt-3 shadow-lg shadow-red-500/20"
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">Sign In</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-center mt-6 items-center">
                <Text className="text-zinc-400 text-sm">Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/register' as any)}>
                  <Text className="text-red-500 font-bold text-sm">Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
