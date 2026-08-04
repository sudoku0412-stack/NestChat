import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, fontWeight, space } from '../lib/theme';

interface StatusRingProps {
  name: string;
  avatarUrl?: string | null;
  hasStatus: boolean;
  hasUnviewed: boolean;
  isSelf?: boolean;
  onPress: () => void;
}

export function StatusRing({ name, avatarUrl, hasStatus, hasUnviewed, isSelf, onPress }: StatusRingProps) {
  const { colors: accentColors } = useAccentTheme();
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View
        style={[
          styles.ring,
          hasStatus && {
            borderColor: hasUnviewed ? accentColors.accent : colors.neutral700,
          },
        ]}
      >
        <Avatar name={name} avatarUrl={avatarUrl} size={56} />
        {isSelf && !hasStatus && (
          <View style={[styles.plusBadge, { backgroundColor: accentColors.accent }]}>
            <Text style={styles.plusGlyph}>+</Text>
          </View>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {isSelf ? 'My status' : name}
      </Text>
    </Pressable>
  );
}

const RING_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    width: 72,
    alignItems: 'center',
    gap: space[1],
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  plusGlyph: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    lineHeight: 14,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    maxWidth: 72,
  },
});
