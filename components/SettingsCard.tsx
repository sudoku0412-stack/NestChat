import { Children } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, type Colors } from '../lib/theme';

interface SettingsCardProps {
  children: React.ReactNode;
  /** Defaults to the legacy dark-only `colors` alias — see ScreenHeader's theme prop for why. */
  theme?: Colors;
}

/**
 * Groups a list of `SettingsRow`s into one rounded, surface-colored card with a divider
 * *between* rows (not a trailing one after the last row) — the grouping the Settings-list
 * mockup used, which plain per-row borders can't reproduce on their own.
 */
export function SettingsCard({ children, theme = colors }: SettingsCardProps) {
  const items = Children.toArray(children);
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: theme.divider } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
