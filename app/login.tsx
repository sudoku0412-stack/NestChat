import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { colors, fontWeight, radius, space } from '../lib/theme';
import { OutlineButton } from '../components/OutlineButton';

export default function LoginScreen() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Redirect href="/(app)" />;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const message = await signIn(email.trim(), password);
    setSubmitting(false);
    if (message) setError(message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>INVITE-ONLY · HOUSEHOLD MEMBERS ONLY</Text>
        </View>

        <Text style={styles.wordmark}>NestChat</Text>
        <View style={styles.underline} />
        <Text style={styles.tagline}>Private messaging for your household.</Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@household.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: space[6] }}>
            <OutlineButton label="Enter Nest" onPress={handleSubmit} loading={submitting} disabled={!email || !password} />
          </View>

          <Text style={styles.footnote}>
            No self-serve sign-up — a household admin creates your account.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginBottom: space[8],
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  wordmark: {
    color: colors.text,
    fontSize: 40,
    fontWeight: fontWeight.heading,
  },
  underline: {
    width: 56,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: space[2],
    marginBottom: space[4],
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: space[8],
  },
  form: {
    marginTop: space[4],
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    marginBottom: space[2],
    marginTop: space[4],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.danger,
    marginTop: space[4],
    fontSize: 13,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: space[6],
    textAlign: 'center',
  },
});
