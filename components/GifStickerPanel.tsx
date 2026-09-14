import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../lib/themeMode';
import { fontWeight, radius, space } from '../lib/theme';
import { useAccentTheme } from '../lib/accentTheme';
import {
  searchGifs,
  searchStickers,
  trendingGifs,
  trendingStickers,
  type GiphyItem,
} from '../lib/giphy';

interface GifStickerPanelProps {
  open: boolean;
  onSelect: (item: GiphyItem, kind: 'gif' | 'sticker') => void;
}

type Tab = 'gif' | 'sticker';
const SEARCH_DEBOUNCE_MS = 400;
const COLUMN_COUNT = 3;

// Renders inline, in the same footprint the keyboard would otherwise occupy (see Composer.tsx,
// which sizes this panel's parent View to the device's own last-measured keyboard height) --
// deliberately not a Modal/bottom-sheet, so opening it reads as "swap what's docked at the
// bottom" rather than "a new screen slides up," matching WhatsApp/Telegram's sticker tray.
export function GifStickerPanel({ open, onSelect }: GifStickerPanelProps) {
  const { colors: accentColors } = useAccentTheme();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('gif');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setItems([]);
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(
      () => {
        setLoading(true);
        const fetcher = query.trim()
          ? tab === 'gif'
            ? searchGifs(query.trim())
            : searchStickers(query.trim())
          : tab === 'gif'
            ? trendingGifs()
            : trendingStickers();

        fetcher
          .then(setItems)
          .catch((err) => console.warn('Giphy request failed', err))
          .finally(() => setLoading(false));
      },
      query.trim() ? SEARCH_DEBOUNCE_MS : 0
    );

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, tab, query]);

  if (!open) return null;

  return (
    <View style={[styles.panel, { backgroundColor: theme.bg }]}>
      <View style={styles.segmentWrapper}>
        <View style={[styles.segment, { backgroundColor: theme.bgDeep }]}>
          <Pressable
            style={[styles.segmentHalf, tab === 'gif' && { backgroundColor: accentColors.accent }]}
            onPress={() => setTab('gif')}
          >
            <Text style={[styles.segmentLabel, { color: theme.textMuted }, tab === 'gif' && { color: theme.text }]}>
              GIF
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentHalf, tab === 'sticker' && { backgroundColor: accentColors.accent }]}
            onPress={() => setTab('sticker')}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: theme.textMuted },
                tab === 'sticker' && { color: theme.text },
              ]}
            >
              Stickers
            </Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={[styles.search, { color: theme.text, backgroundColor: theme.bgDeep }]}
        value={query}
        onChangeText={setQuery}
        placeholder={tab === 'gif' ? 'Search GIFs' : 'Search stickers'}
        placeholderTextColor={theme.textMuted}
      />

      {loading ? (
        <ActivityIndicator color={accentColors.accent} style={styles.loading} />
      ) : items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          {query.trim() ? 'No results.' : 'Nothing trending right now — try a search.'}
        </Text>
      ) : (
        <FlatList
          data={items}
          key={tab}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={[styles.cell, { backgroundColor: theme.bgDeep }]} onPress={() => onSelect(item, tab === 'gif' ? 'gif' : 'sticker')}>
              <Image source={{ uri: item.previewUrl }} style={styles.cellImage} contentFit="cover" />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  segmentWrapper: {
    alignItems: 'center',
    paddingTop: space[3],
    marginBottom: space[3],
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.full,
    padding: 3,
  },
  segmentHalf: {
    paddingHorizontal: space[6],
    paddingVertical: space[2],
    borderRadius: radius.full,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  search: {
    marginHorizontal: space[4],
    marginBottom: space[3],
    fontSize: 15,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.xl,
  },
  loading: {
    paddingVertical: space[8],
  },
  empty: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
  grid: {
    paddingHorizontal: space[3],
    paddingBottom: space[4],
  },
  cell: {
    flex: 1 / COLUMN_COUNT,
    aspectRatio: 1,
    margin: space[1],
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
});
