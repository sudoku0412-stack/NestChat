import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontWeight, radius, space } from '../lib/theme';

interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'accent' | 'neutral' | 'danger';
}

export function OutlineButton({ label, onPress, disabled, loading, variant = 'accent' }: OutlineButtonProps) {
  const color =
    variant === 'danger' ? colors.danger : variant === 'neutral' ? colors.textMuted : colors.accent;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { borderColor: color, opacity: isDisabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
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
