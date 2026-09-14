import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAccentTheme } from '../lib/accentTheme';
import { useTheme } from '../lib/themeMode';
import { fontWeight } from '../lib/theme';
import { ArchiveIcon, BellIcon, BellOffIcon, StarIcon, TrashIcon } from './icons';

const LEFT_ACTIONS_WIDTH = 120; // Mute/Unmute + Delete
const RIGHT_ACTION_WIDTH = 120; // Favorite/Unfavorite + Archive/Unarchive
const LEFT_OPEN_THRESHOLD = 60;
const RIGHT_OPEN_THRESHOLD = 60;

interface SwipeableRowProps {
  children: React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  onMuteToggle: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onFavoriteToggle: () => void;
  muted: boolean;
  favorite: boolean;
  isArchived?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Disables swipe actions while a multi-select mode is active elsewhere in the list. */
  disabled?: boolean;
}

export function SwipeableRow({
  children,
  onPress,
  onLongPress,
  onMuteToggle,
  onDelete,
  onArchive,
  onFavoriteToggle,
  muted,
  favorite,
  isArchived = false,
  isOpen,
  onOpenChange,
  disabled = false,
}: SwipeableRowProps) {
  const { colors: accentColors } = useAccentTheme();
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const closeTo = (value: number, open: boolean) => {
    translateX.value = withSpring(value, { damping: 20, stiffness: 220 });
    onOpenChange(open);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      translateX.value = Math.max(-LEFT_ACTIONS_WIDTH, Math.min(RIGHT_ACTION_WIDTH, next));
    })
    .onEnd((e) => {
      const current = translateX.value;
      if (current <= -LEFT_OPEN_THRESHOLD) {
        translateX.value = withSpring(-LEFT_ACTIONS_WIDTH, { damping: 20, stiffness: 220 });
        runOnJS(onOpenChange)(true);
      } else if (current >= RIGHT_OPEN_THRESHOLD) {
        translateX.value = withSpring(RIGHT_ACTION_WIDTH, { damping: 20, stiffness: 220 });
        runOnJS(onOpenChange)(true);
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        runOnJS(onOpenChange)(false);
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    if (isOpen) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      runOnJS(onOpenChange)(false);
    } else {
      runOnJS(onPress)();
    }
  });

  const longPress = Gesture.LongPress().onStart(() => {
    if (onLongPress) runOnJS(onLongPress)();
  });

  const composed = Gesture.Race(Gesture.Simultaneous(pan, tap), longPress);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    if (!isOpen) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    }
  }, [isOpen, translateX]);

  if (disabled) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress}>
        <View style={[styles.foreground, { backgroundColor: theme.bg }]}>{children}</View>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.leftActionTrack}>
        <Pressable
          style={[styles.action, { backgroundColor: accentColors.accent600, width: 60 }]}
          onPress={() => {
            onFavoriteToggle();
            closeTo(0, false);
          }}
        >
          <StarIcon size={18} color={theme.text} filled={favorite} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>{favorite ? 'Unfavorite' : 'Favorite'}</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { backgroundColor: accentColors.accent700, width: 60 }]}
          onPress={() => {
            onArchive();
            closeTo(0, false);
          }}
        >
          <ArchiveIcon size={18} color={theme.text} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>{isArchived ? 'Unarchive' : 'Archive'}</Text>
        </Pressable>
      </View>

      <View style={styles.rightActionTrack}>
        <Pressable
          style={[styles.action, { backgroundColor: theme.neutral700, width: 60 }]}
          onPress={() => {
            onMuteToggle();
            closeTo(0, false);
          }}
        >
          {muted ? (
            <BellOffIcon size={18} color={theme.text} />
          ) : (
            <BellIcon size={18} color={theme.text} />
          )}
          <Text style={[styles.actionLabel, { color: theme.text }]}>{muted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { backgroundColor: theme.danger, width: 60 }]}
          onPress={() => {
            onDelete();
            closeTo(0, false);
          }}
        >
          <TrashIcon size={18} color={theme.text} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>Delete</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.foreground, { backgroundColor: theme.bg }, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  foreground: {},
  leftActionTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  rightActionTrack: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
  actionLabel: {
    fontWeight: fontWeight.medium,
    fontSize: 13,
    textAlign: 'center',
  },
});
