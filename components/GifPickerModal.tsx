import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, fontWeight, radius, space } from '../lib/theme';
import { useAccentTheme } from '../lib/accentTheme';
import {
  searchGifs,
  searchStickers,
  trendingGifs,
  trendingStickers,
  type GiphyItem,
} from '../lib/giphy';

interface GifPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: GiphyItem, kind: 'gif' | 'sticker') => void;
}

type Tab = 'gif' | 'sticker';
const SEARCH_DEBOUNCE_MS = 400;
const COLUMN_COUNT = 3;

export function GifPickerModal({ visible, onClose, onSelect }: GifPickerModalProps) {
  const { colors: accentColors } = useAccentTheme();
  const [tab, setTab] = useState<Tab>('gif');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setItems([]);
  }, [visible, tab]);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, tab, query]);

  function handleSelect(item: GiphyItem) {
    onSelect(item, tab === 'gif' ? 'gif' : 'sticker');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.segmentWrapper}>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentHalf, tab === 'gif' && { backgroundColor: accentColors.accent }]}
                onPress={() => setTab('gif')}
              >
                <Text style={[styles.segmentLabel, tab === 'gif' && styles.segmentLabelActive]}>GIF</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentHalf, tab === 'sticker' && { backgroundColor: accentColors.accent }]}
                onPress={() => setTab('sticker')}
              >
                <Text style={[styles.segmentLabel, tab === 'sticker' && styles.segmentLabelActive]}>
                  Stickers
                </Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'gif' ? 'Search GIFs' : 'Search stickers'}
            placeholderTextColor={colors.textMuted}
          />

          {loading ? (
            <ActivityIndicator color={accentColors.accent} style={styles.loading} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>
              {query.trim() ? 'No results.' : `Nothing trending right now — try a search.`}
            </Text>
          ) : (
            <FlatList
              data={items}
              key={tab}
              keyExtractor={(item) => item.id}
              numColumns={COLUMN_COUNT}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <Pressable style={styles.cell} onPress={() => handleSelect(item)}>
                  <Image source={{ uri: item.previewUrl }} style={styles.cellImage} contentFit="cover" />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space[4],
  },
  segmentWrapper: {
    alignItems: 'center',
    marginBottom: space[3],
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.full,
    padding: 3,
  },
  segmentHalf: {
    paddingHorizontal: space[6],
    paddingVertical: space[2],
    borderRadius: radius.full,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  segmentLabelActive: {
    color: colors.text,
  },
  search: {
    marginHorizontal: space[4],
    marginBottom: space[3],
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: colors.bgDeep,
    borderRadius: radius.xl,
  },
  loading: {
    paddingVertical: space[8],
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
  grid: {
    paddingHorizontal: space[3],
    paddingBottom: space[8],
  },
  cell: {
    flex: 1 / COLUMN_COUNT,
    aspectRatio: 1,
    margin: space[1],
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bgDeep,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
});
