import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, fonts, radius, space } from '../lib/theme';
import { OutlineButton } from '../components/OutlineButton';

function isPlausiblePhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function isPlausiblePin(value: string) {
  return /^\d{4,6}$/.test(value.trim());
}

// 'set_recovery_pin': an account already exists for this phone but never had a PIN (created
// before this feature, or an abandoned signup) — self-service, no admin needed: whatever PIN is
// entered here becomes that account's PIN as part of recovering it.
type Step = 'phone' | 'create_pin' | 'enter_pin' | 'set_recovery_pin';

export default function LoginScreen() {
  const { session, profile, checkPhone, claimPhone, recoverAccount } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only redirect once a phone has actually been claimed/recovered onto this session.
  if (session && profile?.phone) return <Redirect href="/" />;

  const phoneValid = isPlausiblePhone(phone);
  const pinValid = isPlausiblePin(pin);
  const needsConfirm = step === 'create_pin' || step === 'set_recovery_pin';

  async function handlePhoneSubmit() {
    if (!phoneValid) {
      setError('Enter your number in international format, e.g. +15551234567');
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await checkPhone(phone.trim());
    setSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    if (!result.exists) setStep('create_pin');
    else if (result.hasPin) setStep('enter_pin');
    else setStep('set_recovery_pin');
  }

  async function handleCreatePin() {
    if (!pinValid) {
      setError('PIN must be 4-6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const message = await claimPhone(phone.trim(), pin);
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace('/');
  }

  async function handleRecoverPin() {
    if (!pinValid) {
      setError('PIN must be 4-6 digits.');
      return;
    }
    if (needsConfirm && pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const message = await recoverAccount(phone.trim(), pin);
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>HOUSEHOLD MEMBERS ONLY</Text>
        </View>

        <Text style={styles.wordmark}>NestChat</Text>
        <View style={[styles.underline, { backgroundColor: accentColors.accent }]} />

        {step === 'phone' && (
          <>
            <Text style={styles.tagline}>Enter your phone number to sign in or join.</Text>
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Phone number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                placeholder="+15551234567"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.hint}>
                Include your country code (e.g. +1 for US/Canada). No code is sent — this just
                identifies you.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={{ marginTop: space[6] }}>
                <OutlineButton
                  label="Continue"
                  onPress={handlePhoneSubmit}
                  loading={submitting}
                  disabled={!phoneValid}
                />
              </View>
            </View>
          </>
        )}

        {step === 'create_pin' && (
          <>
            <Text style={styles.tagline}>
              Create a recovery PIN. You'll need it to get your chats back if you ever sign out
              or reinstall.
            </Text>
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>4-6 digit PIN</Text>
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="number-pad"
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Confirm PIN</Text>
              <TextInput
                style={styles.input}
                value={pinConfirm}
                onChangeText={setPinConfirm}
                secureTextEntry
                keyboardType="number-pad"
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={{ marginTop: space[6] }}>
                <OutlineButton
                  label="Continue"
                  onPress={handleCreatePin}
                  loading={submitting}
                  disabled={!pinValid || pinConfirm.length === 0}
                />
              </View>
            </View>
          </>
        )}

        {step === 'enter_pin' && (
          <>
            <Text style={styles.tagline}>
              This number already has an account. Enter your PIN to get your chats back.
            </Text>
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>PIN</Text>
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="number-pad"
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={{ marginTop: space[6] }}>
                <OutlineButton
                  label="Recover account"
                  onPress={handleRecoverPin}
                  loading={submitting}
                  disabled={!pinValid}
                />
              </View>
            </View>
          </>
        )}

        {step === 'set_recovery_pin' && (
          <>
            <Text style={styles.tagline}>
              This number already has an account, but it doesn't have a recovery PIN yet. Set one
              now to get your chats back — you'll use it next time too.
            </Text>
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>4-6 digit PIN</Text>
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="number-pad"
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldLabel}>Confirm PIN</Text>
              <TextInput
                style={styles.input}
                value={pinConfirm}
                onChangeText={setPinConfirm}
                secureTextEntry
                keyboardType="number-pad"
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={{ marginTop: space[6] }}>
                <OutlineButton
                  label="Recover account"
                  onPress={handleRecoverPin}
                  loading={submitting}
                  disabled={!pinValid || pinConfirm.length === 0}
                />
              </View>
            </View>
          </>
        )}
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
    fontSize: 42,
    fontFamily: fonts.display,
  },
  underline: {
    width: 56,
    height: 3,
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
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: space[2],
  },
  error: {
    color: colors.danger,
    marginTop: space[4],
    fontSize: 13,
  },
});
