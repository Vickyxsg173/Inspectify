import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

const getDevHost = () => {
  // 1. Simulators & Emulators: localhost is direct, instantaneous, and immune to Wi-Fi/firewall drops
  if (!Device.isDevice) {
    if (Platform.OS === 'android') {
      return '10.0.2.2';
    }
    // iOS Simulator & Web: always use localhost
    return 'localhost';
  }

  // 2. Physical device: auto-detected LAN IP from Expo bundler
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
    return expoHost;
  }

  // 3. Explicit environment variable override
  if (process.env.EXPO_PUBLIC_HOST_IP) {
    return process.env.EXPO_PUBLIC_HOST_IP;
  }

  return '192.168.29.45';
};

export const BACKEND_URL = `http://${getDevHost()}:8000`;

