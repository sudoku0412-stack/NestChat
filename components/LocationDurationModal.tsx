import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/themeMode';
import { fontWeight, radius, space } from '../lib/theme';
import type { LiveLocationDuration } from '../lib/database.types';

interface LocationDurationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (duration: LiveLocationDuration) => void;
}

const OPTIONS: { duration: LiveLocationDuration; label: string }[] = [
  { duration: '15m', label: 'For 15 minutes' },
  { duration: '24h', label: 'For 24 hours' },
  { duration: 'until_stopped', label: 'Until I stop it' },
];

export function LocationDurationModal({ visible, onClose, onSelect }: LocationDurationModalProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityViewIsModal>
        <View style={[styles.menu, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.textMuted }]}>Share live location</Text>
          {OPTIONS.map((opt, i) => (
            <View key={opt.duration}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
              <Pressable
                style={styles.item}
                onPress={() => {
                  onSelect(opt.duration);
                  onClose();
                }}
              >
                <Text style={[styles.label, { color: theme.text }]}>{opt.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menu: {
    margin: space[4],
    marginBottom: space[8],
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  title: {
    fontSize: 12,
    textAlign: 'center',
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  item: {
    paddingVertical: space[4],
    paddingHorizontal: space[6],
  },
  label: {
    fontSize: 16,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  divider: {
    height: 1,
  },
});
