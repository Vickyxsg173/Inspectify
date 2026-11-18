import "./global.css";

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider } from '../contexts/AuthContext';

export default function TabLayout() {
  return (
    <AuthProvider>
      <AnimatedSplashOverlay />
      <AppTabs />
    </AuthProvider>
  );
}
