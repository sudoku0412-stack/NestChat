import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { usePresenceHeartbeat } from '../../lib/presence';
import { usePushNotificationRegistration } from '../../lib/notifications';
import { colors } from '../../lib/theme';

export default function AppLayout() {
  const { session, profile, loading } = useAuth();

  usePresenceHeartbeat(profile?.id ?? null);
  usePushNotificationRegistration(profile?.id ?? null);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="media-viewer" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
