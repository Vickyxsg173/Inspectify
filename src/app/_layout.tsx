import "./global.css";

import { AuthProvider } from '../contexts/AuthContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AnimatedSplashOverlay />
      <AppTabs />
    </AuthProvider>
  );
}
