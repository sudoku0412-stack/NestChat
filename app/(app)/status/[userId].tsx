import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { getSignedStatusMediaUrl } from '../../../lib/media';
import { deleteStatus, getStatusViewers, markStatusViewed, type StatusViewer } from '../../../lib/statusActions';
import { Avatar } from '../../../components/Avatar';
import { colors, fontWeight, space } from '../../../lib/theme';
import type { StatusesRow } from '../../../lib/database.types';

const DEFAULT_DURATION_MS = 5000;

function timeAgo(iso: string) {
  const diffMin = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}

export default function StatusViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [statuses, setStatuses] = useState<StatusesRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userName, setUserName] = useState('');
  const [index, setIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StatusViewer[]>([]);
  const progress = useRef(new Animated.Value(0)).current;
  const isOwn = userId === profile?.id;
  const current = statuses[index];

  useEffect(() => {
    async function load() {
      const [{ data: rows }, { data: user }] = await Promise.all([
        supabase
          .from('statuses')
          .select('*')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true }),
        supabase.from('users').select('display_name').eq('id', userId).single(),
      ]);
      setStatuses((rows as StatusesRow[]) ?? []);
      setUserName(user?.display_name ?? '');
      setLoaded(true);
    }
    load();
  }, [userId]);

  useEffect(() => {
    if (!current) {
      if (loaded) router.back();
      return;
    }
    if (profile) markStatusViewed(current.id, profile.id);

    if (current.storage_path) {
      getSignedStatusMediaUrl(current.storage_path).then(setMediaUrl);
    } else {
      setMediaUrl(null);
    }

    progress.setValue(0);
    const duration = current.type === 'video' ? 8000 : DEFAULT_DURATION_MS;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) advance();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function advance() {
    if (index < statuses.length - 1) {
      setIndex((i) => i + 1);
    } else {
      router.back();
    }
  }

  function goBackOne() {
    if (index > 0) setIndex((i) => i - 1);
  }

  async function openViewers() {
    if (!current) return;
    const list = await getStatusViewers(current.id);
    setViewers(list);
    setViewersOpen(true);
  }

  function handleDelete() {
    if (!current) return;
    Alert.alert('Delete status?', 'This will remove it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteStatus(current.id);
          if (statuses.length <= 1) {
            router.back();
          } else {
            setStatuses((s) => s.filter((st) => st.id !== current.id));
            setIndex((i) => Math.max(0, i - 1));
          }
        },
      },
    ]);
  }

  if (!current) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, current.type === 'text' ? { backgroundColor: current.background_color ?? colors.bg } : null]}>
      <View style={[styles.progressRow, { top: insets.top + space[2] }]}>
        {statuses.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width:
                    i < index
                      ? '100%'
                      : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={[styles.header, { top: insets.top + space[6] }]}>
        <Avatar name={userName} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{isOwn ? 'My status' : userName}</Text>
          <Text style={styles.headerTime}>{timeAgo(current.created_at)}</Text>
        </View>
        {isOwn && (
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Text style={styles.trash}>🗑</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {current.type === 'text' ? (
          <Text style={styles.textContent}>{current.text_content}</Text>
        ) : !mediaUrl ? (
          <ActivityIndicator color={colors.accent} />
        ) : current.type === 'video' ? (
          <StatusVideo uri={mediaUrl} />
        ) : (
          <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="contain" />
        )}
      </View>

      <View style={styles.tapZones}>
        <Pressable style={{ flex: 1 }} onPress={goBackOne} />
        <Pressable style={{ flex: 2 }} onPress={advance} />
      </View>

      {isOwn && (
        <Pressable style={[styles.viewersBar, { paddingBottom: insets.bottom + space[3] }]} onPress={openViewers}>
          <Text style={styles.viewersText}>👁 Viewed by ‧ tap to see who</Text>
        </Pressable>
      )}

      <Modal visible={viewersOpen} transparent animationType="slide" onRequestClose={() => setViewersOpen(false)}>
        <Pressable style={styles.viewersBackdrop} onPress={() => setViewersOpen(false)}>
          <View style={styles.viewersSheet}>
            <Text style={styles.viewersTitle}>Viewed by ({viewers.length})</Text>
            <FlatList
              data={viewers}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <View style={styles.viewerRow}>
                  <Avatar name={item.display_name} avatarUrl={item.avatar_url} size={36} />
                  <Text style={styles.viewerName}>{item.display_name}</Text>
                  <Text style={styles.viewerTime}>{timeAgo(item.viewed_at)}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No one has viewed this yet.</Text>}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatusVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={styles.media} contentFit="contain" />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    flexDirection: 'row',
    gap: space[1],
    zIndex: 2,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    zIndex: 2,
  },
  headerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  headerTime: {
    color: 'rgba(233,233,237,0.7)',
    fontSize: 11,
  },
  trash: {
    fontSize: 18,
  },
  close: {
    color: colors.text,
    fontSize: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  textContent: {
    color: colors.text,
    fontSize: 28,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  tapZones: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  viewersBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: space[3],
  },
  viewersText: {
    color: colors.text,
    fontSize: 13,
  },
  viewersBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  viewersSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: space[6],
    maxHeight: '60%',
  },
  viewersTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: fontWeight.medium,
    marginBottom: space[4],
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  viewerName: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  viewerTime: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: space[6],
  },
});
