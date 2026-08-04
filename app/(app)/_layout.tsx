import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { usePresenceHeartbeat } from '../../lib/presence';
import { usePushNotificationRegistration, usePushNotificationNavigation } from '../../lib/notifications';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors } from '../../lib/theme';

export default function AppLayout() {
  const { session, profile, loading, needsOnboarding } = useAuth();
  const { colors: accentColors } = useAccentTheme();

  usePresenceHeartbeat(profile?.id ?? null, !!profile?.show_read_receipts);
  usePushNotificationRegistration(profile?.id ?? null);
  usePushNotificationNavigation();

  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={accentColors.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="media-viewer" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="status/new" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="status/[userId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
