import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, space } from '../lib/theme';

function useBounce(delay: number) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, delay]);

  return value;
}

export function TypingIndicator() {
  const dot1 = useBounce(0);
  const dot2 = useBounce(150);
  const dot3 = useBounce(300);

  const dotStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
  });

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, dotStyle(dot1)]} />
        <Animated.View style={[styles.dot, dotStyle(dot2)]} />
        <Animated.View style={[styles.dot, dotStyle(dot3)]} />
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
