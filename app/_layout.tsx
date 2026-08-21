import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { AuthProvider } from '../lib/auth';
import { AccentThemeProvider } from '../lib/accentTheme';
import { ThemeModeProvider, useThemeMode } from '../lib/themeMode';
import '../lib/locationTask';

function Shell() {
  const { bg, resolvedGround } = useThemeMode();
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      <SafeAreaProvider>
        {/* Status bar text/icon color reads against the app's own ground, not the OS's --
            light text on the dark ground, dark text on the light one. */}
        <StatusBar style={resolvedGround === 'dark' ? 'light' : 'dark'} />
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
