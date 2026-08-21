import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRightIcon } from './icons';
import { colors, fontWeight, space, type Colors } from '../lib/theme';

interface SettingsRowProps {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  /** Custom trailing content (a value string, a Switch, ...). Omit to get a bare chevron when
   * `onPress` is set, or nothing at all for a static row. */
  trailing?: ReactNode;
  labelColor?: string;
  disabled?: boolean;
  /** Defaults to the legacy dark-only `colors` alias — see ScreenHeader's theme prop for why. */
  theme?: Colors;
}

export function SettingsRow({ label, icon, onPress, trailing, labelColor, disabled, theme = colors }: SettingsRowProps) {
  const content = (
    <View style={styles.row}>
      {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
      <Text style={[styles.label, { color: labelColor ?? theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.trailingSlot}>
        {trailing ?? (onPress ? <ChevronRightIcon size={18} color={theme.textMuted} /> : null)}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={disabled ? styles.disabled : undefined}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
  iconSlot: {
    width: 30,
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
  },
  trailingSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  disabled: {
    opacity: 0.5,
  },
});
