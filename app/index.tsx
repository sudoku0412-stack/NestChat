import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, profile, loading, needsOnboarding } = useAuth();

  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(app)/(tabs)" />;
}
