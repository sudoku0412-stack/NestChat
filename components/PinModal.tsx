import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontWeight, radius, space } from '../lib/theme';
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
      >
        <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Recovery PIN</Text>
          <Text style={styles.caption}>
            This lets you get your chats back if you ever sign out or reinstall.
          </Text>

          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="New PIN"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.input}
            value={pinConfirm}
            onChangeText={setPinConfirm}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="Confirm PIN"
            placeholderTextColor={colors.textMuted}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space[6],
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: fontWeight.heading,
    marginBottom: space[2],
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: space[4],
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.bg,
    marginBottom: space[3],
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: space[1],
  },
});
