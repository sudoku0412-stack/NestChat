import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { AuthProvider } from '../lib/auth';
import { ThemeModeProvider, useThemeMode } from '../lib/themeMode';
import '../lib/locationTask';

function Shell() {
  const { bg } = useThemeMode();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Slot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ThemeModeProvider>
  );
}
