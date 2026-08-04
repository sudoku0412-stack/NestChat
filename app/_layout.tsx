import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { useFonts, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { AuthProvider } from '../lib/auth';
import { AccentThemeProvider } from '../lib/accentTheme';
import { ThemeModeProvider, useThemeMode } from '../lib/themeMode';
import '../lib/locationTask';

function Shell() {
  const { bg } = useThemeMode();
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: bg }} />;
  }

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
        <AccentThemeProvider>
          <Shell />
        </AccentThemeProvider>
      </AuthProvider>
    </ThemeModeProvider>
  );
}
