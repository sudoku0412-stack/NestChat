import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight, radius, space } from '../lib/theme';
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menu}>
          <Text style={styles.title}>Share live location</Text>
          {OPTIONS.map((opt, i) => (
            <View key={opt.duration}>
              {i > 0 && <View style={styles.divider} />}
              <Pressable
                style={styles.item}
                onPress={() => {
                  onSelect(opt.duration);
                  onClose();
                }}
              >
                <Text style={styles.label}>{opt.label}</Text>
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  title: {
    color: colors.textMuted,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
});
