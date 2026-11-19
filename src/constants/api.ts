import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getDevHost = () => {
  // If explicitly provided via env variable:
  if (process.env.EXPO_PUBLIC_HOST_IP) {
    return process.env.EXPO_PUBLIC_HOST_IP;
  }
  // Expo auto-detects development computer host IP:
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (expoHost) {
    return expoHost;
  }
  // Android Emulator standard loopback to host machine
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  // iOS Simulator / Web localhost
  return 'localhost';
};

export const BACKEND_URL = `http://${getDevHost()}:8000`;
