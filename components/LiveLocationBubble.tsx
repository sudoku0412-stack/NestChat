import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccentTheme } from '../lib/accentTheme';
import { useTheme } from '../lib/themeMode';
import { fontWeight, radius, space } from '../lib/theme';
import { stopLiveLocationShare } from '../lib/liveLocation';
import type { LiveLocationsRow } from '../lib/database.types';

interface LiveLocationBubbleProps {
  location: LiveLocationsRow;
  isOwn: boolean;
}

function isActive(location: LiveLocationsRow) {
  if (location.stopped_at) return false;
  if (location.expires_at && new Date(location.expires_at) <= new Date()) return false;
  return true;
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function LiveLocationBubble({ location, isOwn }: LiveLocationBubbleProps) {
  const [, setTick] = useState(0);
  const active = isActive(location);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, [active]);

  const mapsUrl = `https://maps.google.com/?q=${location.lat},${location.lng}`;
  const { colors: accentColors } = useAccentTheme();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.bubble,
        isOwn
          ? [styles.bubbleOwn, { backgroundColor: accentColors.accent900, borderColor: accentColors.accent }]
          : [styles.bubbleOther, { backgroundColor: theme.surface }],
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.glyph}>📍</Text>
        <Text style={[styles.title, { color: theme.text }]}>{active ? 'Live location' : 'Live location ended'}</Text>
      </View>
      <Text style={[styles.meta, { color: theme.textMuted }]}>
        {active ? `Updated ${timeAgo(location.updated_at)}` : `Last seen ${timeAgo(location.updated_at)}`}
      </Text>
      <Pressable onPress={() => Linking.openURL(mapsUrl)}>
        <Text style={[styles.link, { color: accentColors.accent }]}>Open in Maps</Text>
      </Pressable>
      {isOwn && active && (
        <Pressable style={[styles.stopButton, { borderColor: theme.danger }]} onPress={() => stopLiveLocationShare(location.id)}>
          <Text style={[styles.stopLabel, { color: theme.danger }]}>Stop sharing</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minWidth: 200,
    gap: space[1],
  },
  bubbleOwn: {
    borderWidth: 1,
  },
  bubbleOther: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  glyph: {
    fontSize: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
  meta: {
    fontSize: 12,
  },
  link: {
    fontSize: 13,
    marginTop: space[1],
    fontWeight: fontWeight.medium,
  },
  stopButton: {
    marginTop: space[2],
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[4],
    paddingVertical: space[1],
  },
  stopLabel: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
});
