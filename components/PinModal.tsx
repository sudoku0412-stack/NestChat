import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../lib/themeMode';
import { fontWeight, radius, space } from '../lib/theme';
import { OutlineButton } from './OutlineButton';

interface PinModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<string | null>;
}

function isPlausiblePin(value: string) {
  return /^\d{4,6}$/.test(value.trim());
}

export function PinModal({ visible, onClose, onSubmit }: PinModalProps) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPin('');
    setPinConfirm('');
    setError(null);
  }

  async function handleSubmit() {
    if (!isPlausiblePin(pin)) {
      setError('PIN must be 4-6 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }
    setSubmitting(true);
    const message = await onSubmit(pin);
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    reset();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          reset();
          onClose();
        }}
        accessibilityViewIsModal
      >
        <Pressable style={[styles.menu, { backgroundColor: theme.surface }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: theme.text }]}>Recovery PIN</Text>
          <Text style={[styles.caption, { color: theme.textMuted }]}>
            This lets you get your chats back if you ever sign out or reinstall.
          </Text>

          <TextInput
            style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.bg }]}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="New PIN"
            placeholderTextColor={theme.textMuted}
          />
          <TextInput
            style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.bg }]}
            value={pinConfirm}
            onChangeText={setPinConfirm}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="Confirm PIN"
            placeholderTextColor={theme.textMuted}
          />

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          <View style={{ marginTop: space[4] }}>
            <OutlineButton label="Save PIN" onPress={handleSubmit} loading={submitting} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
  },
  menu: {
    margin: space[6],
    borderRadius: radius.md,
    padding: space[6],
  },
  title: {
    fontSize: 17,
    fontWeight: fontWeight.heading,
    marginBottom: space[2],
  },
  caption: {
    fontSize: 12,
    marginBottom: space[4],
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontSize: 16,
    marginBottom: space[3],
  },
  error: {
    fontSize: 13,
    marginTop: space[1],
  },
});
