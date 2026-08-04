import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useAccentTheme } from '../lib/accentTheme';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, profile, loading, needsOnboarding } = useAuth();
  const { colors: accentColors } = useAccentTheme();

  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={accentColors.accent} />
      </View>
    );
  }

  // A session with no phone claimed yet is an abandoned/in-progress login (see lib/auth.tsx
  // claimPhone/recoverAccount) — send it back to finish there, not into onboarding.
  if (!session || !profile?.phone) return <Redirect href="/login" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(app)/(tabs)" />;
}
