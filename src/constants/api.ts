import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getDevHost = () => {
  // 1. Expo automatically detects the computer's active LAN IP from the bundler connection:
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
    return expoHost;
  }
  // 2. Explicit environment variable override:
  if (process.env.EXPO_PUBLIC_HOST_IP) {
    return process.env.EXPO_PUBLIC_HOST_IP;
  }
  // 3. Android Emulator loopback to host machine:
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  // 4. iOS Simulator / Web localhost:
  return 'localhost';
};

export const BACKEND_URL = `http://${getDevHost()}:8000`;
