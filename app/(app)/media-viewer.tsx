import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getSignedMediaUrl } from '../../lib/media';
import { softDeleteMessage } from '../../lib/chatActions';
import { decryptTextField, getDecryptedMediaUri, isEncryptedRow } from '../../lib/crypto';
import { useAuth } from '../../lib/auth';
import { colors, fontWeight, space } from '../../lib/theme';
import { CloseIcon } from '../../components/icons';
import { useAccentTheme } from '../../lib/accentTheme';
import type { MediaKind } from '../../lib/database.types';

function VideoPlayerView({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView player={player} style={styles.media} contentFit="contain" fullscreenOptions={{ enable: true }} />
  );
}

export default function MediaViewerScreen() {
  const { colors: accentColors } = useAccentTheme();
  const { messageId, mediaId, ownMessage } = useLocalSearchParams<{
    messageId: string;
    mediaId: string;
    ownMessage?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaKind>('photo');
  const [caption, setCaption] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  useEffect(() => {
    async function load() {
      const { data: media } = await supabase.from('message_media').select('*').eq('id', mediaId).single();
      const { data: message } = await supabase
        .from('messages')
        .select('chat_id, body, created_at, sender_id, enc_v, key_id, ciphertext, users(display_name)')
        .eq('id', messageId)
        .single();

      if (media) {
        setKind(media.kind);
        const resolved =
          media.wrapped_key && message?.key_id && profile?.id
            ? await getDecryptedMediaUri({
                mediaId: media.id,
                storagePath: media.storage_path,
                wrappedKey: media.wrapped_key,
                chatId: message.chat_id,
                messageId,
                keyId: message.key_id,
                myUserId: profile.id,
              })
            : await getSignedMediaUrl(media.storage_path);
        setUrl(resolved);
      }
      if (message) {
        const caption = isEncryptedRow(message)
          ? await decryptTextField({
              chatId: message.chat_id,
              messageId,
              senderId: message.sender_id,
              plaintextBody: message.body,
              encrypted: { enc_v: message.enc_v, key_id: message.key_id, ciphertext: message.ciphertext },
              myUserId: profile?.id ?? null,
            })
          : message.body;
        setCaption(caption);
        setCreatedAt(message.created_at);
        setSenderName((message.users as unknown as { display_name: string } | null)?.display_name ?? '');
      }
    }
    load();
  }, [messageId, mediaId]);

  function handleDelete() {
    Alert.alert('Delete message?', 'This will remove the message for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteMessage(messageId);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + space[2] }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.close}>
          <CloseIcon size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.kindLabel}>
          {kind === 'video' ? 'Video' : kind === 'gif' ? 'GIF' : kind === 'sticker' ? 'Sticker' : 'Photo'}
        </Text>
        {ownMessage === '1' ? (
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Text style={styles.trash}>🗑</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <View style={styles.center}>
        {!url ? (
          <ActivityIndicator color={accentColors.accent} />
        ) : kind === 'video' ? (
          <VideoPlayerView uri={url} />
        ) : (
          <Image source={{ uri: url }} style={styles.media} contentFit="contain" />
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space[4] }]}>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        <Text style={styles.metaLine}>
          {senderName} · {createdAt ? new Date(createdAt).toLocaleString() : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingBottom: space[3],
  },
  close: {
    width: 24,
  },
  kindLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  trash: {
    fontSize: 18,
    width: 24,
    textAlign: 'right',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    paddingHorizontal: space[6],
    paddingTop: space[3],
    gap: space[1],
  },
  caption: {
    color: colors.text,
    fontSize: 15,
  },
  metaLine: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
