import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon } from './icons';
import { colors, fontWeight, space, type Colors } from '../lib/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Defaults to router.back(). Pass null to hide the back chevron entirely. */
  onBack?: (() => void) | null;
  right?: ReactNode;
  /**
   * Replaces the title/subtitle text entirely (e.g. the chat thread header's tappable
   * avatar + name + last-seen row). `title`/`subtitle` are still required as a plain-text
   * fallback identity even when this is set.
   */
  centerContent?: ReactNode;
  /**
   * The active theme (from `useTheme()`). Defaults to the legacy dark-only `colors` alias so a
   * screen that hasn't migrated its own body colors yet still renders exactly as before — pass
   * the real theme once the whole screen reads from `useTheme()`.
   */
  theme?: Colors;
}

/**
 * Shared replacement for the ~20 screens that used to hand-roll an identical
 * back-chevron + centered-title + 2px-rule header. No rule underneath by design — spacing
 * alone marks the boundary, matching the rest of Hearth 2.0's flatter chrome.
 */
export function ScreenHeader({ title, subtitle, onBack, right, centerContent, theme = colors }: ScreenHeaderProps) {
  const handleBack = onBack === null ? null : onBack ?? (() => router.back());
  return (
    <View style={styles.row}>
      {handleBack ? (
        <Pressable onPress={handleBack} hitSlop={8} style={styles.backBtn}>
          <ChevronLeftIcon size={22} color={theme.text} />
        </Pressable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <View style={styles.titleWrap}>
        {centerContent ?? (
          <>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  backBtn: {
    width: 30,
    height: 30,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: fontWeight.semibold,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  rightSlot: {
    minWidth: 30,
    alignItems: 'flex-end',
  },
});
