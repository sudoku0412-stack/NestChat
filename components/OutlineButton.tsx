import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, fontWeight, radius, space } from '../lib/theme';

interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'accent' | 'neutral' | 'danger';
  /** Solid fill for the primary action on a screen — plain outline (the default) reads as the
   * secondary/lower-emphasis action now that a filled option exists. */
  filled?: boolean;
}

export function OutlineButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'accent',
  filled = false,
}: OutlineButtonProps) {
  const { colors: accentColors } = useAccentTheme();
  const scale = useSharedValue(1);
  const color =
    variant === 'danger' ? colors.danger : variant === 'neutral' ? colors.textMuted : accentColors.accent;
  const contrastColor = variant === 'accent' ? accentColors.accent100 : colors.text;
  const isDisabled = disabled || loading;

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 100 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
    >
      <Animated.View
        style={[
          styles.base,
          filled ? { backgroundColor: color } : { borderColor: color, borderWidth: 1.5 },
          { opacity: isDisabled ? 0.4 : 1 },
          pressStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={filled ? contrastColor : color} />
        ) : (
          <Text style={[styles.label, { color: filled ? contrastColor : color }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: space[4],
    paddingHorizontal: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: fontWeight.semibold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
