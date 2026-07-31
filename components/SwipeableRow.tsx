import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, fontWeight } from '../lib/theme';

const LEFT_ACTIONS_WIDTH = 120; // Mute/Unmute + Delete
const RIGHT_ACTION_WIDTH = 90; // Archive
const LEFT_OPEN_THRESHOLD = 60;
const RIGHT_OPEN_THRESHOLD = 45;

interface SwipeableRowProps {
  children: React.ReactNode;
  onPress: () => void;
  onMuteToggle: () => void;
  onDelete: () => void;
  onArchive: () => void;
  muted: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SwipeableRow({
  children,
  onPress,
  onMuteToggle,
  onDelete,
  onArchive,
  muted,
  isOpen,
  onOpenChange,
}: SwipeableRowProps) {
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

  const composed = Gesture.Simultaneous(pan, tap);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    if (!isOpen) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    }
  }, [isOpen, translateX]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.leftActionTrack}>
        <Pressable
          style={[styles.action, { backgroundColor: colors.accent700, width: RIGHT_ACTION_WIDTH }]}
          onPress={() => {
            onArchive();
            closeTo(0, false);
          }}
        >
          <Text style={styles.actionLabel}>Archive</Text>
        </Pressable>
      </View>

      <View style={styles.rightActionTrack}>
        <Pressable
          style={[styles.action, { backgroundColor: colors.neutral700, width: 60 }]}
          onPress={() => {
            onMuteToggle();
            closeTo(0, false);
          }}
        >
          <Text style={styles.actionLabel}>{muted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { backgroundColor: colors.danger, width: 60 }]}
          onPress={() => {
            onDelete();
            closeTo(0, false);
          }}
        >
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.foreground, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  foreground: {
    backgroundColor: colors.bg,
  },
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
    height: '100%',
  },
  actionLabel: {
    color: colors.text,
    fontWeight: fontWeight.medium,
    fontSize: 13,
  },
});
