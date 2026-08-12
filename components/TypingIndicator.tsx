import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, space } from '../lib/theme';

function useBounce(delay: number) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 300 })
        ),
        -1
      )
    );
    return () => cancelAnimation(value);
  }, [value, delay]);

  return useAnimatedStyle(() => ({
    opacity: 0.3 + value.value * 0.7,
    transform: [{ translateY: value.value * -3 }],
  }));
}

// Same grouped-bubble shape as a real message from the other side, so the indicator reads as
// "someone is about to send a message here" instead of a floating, differently-styled widget.
export function TypingIndicator() {
  const dot1Style = useBounce(0);
  const dot2Style = useBounce(150);
  const dot3Style = useBounce(300);

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
        <Animated.View style={[styles.dot, dot3Style]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[6],
    paddingVertical: space[1],
    alignItems: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    gap: space[1],
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderBottomLeftRadius: radius.sm,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.textMuted,
  },
});
