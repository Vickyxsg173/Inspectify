import Constants from 'expo-constants';

const HOST_IP = process.env.EXPO_PUBLIC_HOST_IP || Constants.expoConfig?.hostUri?.split(':')[0] || '192.168.29.140';

export const BACKEND_URL = `http://${HOST_IP}:8000`;
