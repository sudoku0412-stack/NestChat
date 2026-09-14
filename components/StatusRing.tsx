import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { useTheme } from '../lib/themeMode';
import { useAccentTheme } from '../lib/accentTheme';
import { fontWeight, space } from '../lib/theme';

interface StatusRingProps {
  name: string;
  avatarUrl?: string | null;
  hasStatus: boolean;
  hasUnviewed: boolean;
  isSelf?: boolean;
  onPress: () => void;
}

// Status-post ring (has an unviewed vs. already-viewed status) is intentionally a different
// width AND color from the presence ring elsewhere in the app (see Avatar/ChatRow's presence
// dot, which is a filled dot, not a ring, plus StatusRing itself is never used to show presence)
// — a 3px gold ring for "unviewed" and a 2px neutral ring for "viewed" so the two states, and
// this ring vs. any future presence ring, never read as the same affordance.
const UNVIEWED_RING_WIDTH = 3;
const VIEWED_RING_WIDTH = 2;

export function StatusRing({ name, avatarUrl, hasStatus, hasUnviewed, isSelf, onPress }: StatusRingProps) {
  const theme = useTheme();
  const { colors: accentColors } = useAccentTheme();
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View
        style={[
          styles.ring,
          hasStatus && {
            borderColor: hasUnviewed ? theme.highlight : theme.divider,
            borderWidth: hasUnviewed ? UNVIEWED_RING_WIDTH : VIEWED_RING_WIDTH,
          },
        ]}
      >
        <Avatar name={name} avatarUrl={avatarUrl} size={56} />
        {isSelf && !hasStatus && (
          <View style={[styles.plusBadge, { backgroundColor: accentColors.accent, borderColor: theme.bg }]}>
            <Text style={styles.plusGlyph}>+</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color: theme.textMuted }]} numberOfLines={1}>
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
  },
  plusGlyph: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    lineHeight: 14,
  },
  label: {
    fontSize: 11,
    maxWidth: 72,
  },
});
