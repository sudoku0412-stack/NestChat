import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useStatuses, type StatusGroup } from '../../../lib/hooks/useStatuses';
import { Avatar } from '../../../components/Avatar';
import { useAccentTheme } from '../../../lib/accentTheme';
import { colors, fontWeight, space } from '../../../lib/theme';
import { useThemeMode } from '../../../lib/themeMode';

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { groups, myStatuses, loading, refresh } = useStatuses(profile?.id ?? null);
  const { bg } = useThemeMode();
  const { colors: accentColors } = useAccentTheme();

  function handleMyStatusPress() {
    if (!profile) return;
    if (myStatuses.length > 0) {
      router.push(`/(app)/status/${profile.id}`);
    } else {
      router.push('/(app)/status/new');
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Status</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/(app)/status/new')} hitSlop={8}>
          <Text style={styles.addGlyph}>＋</Text>
        </Pressable>
      </View>
      <View style={styles.headerRule} />

      <FlatList
        data={groups}
        keyExtractor={(g: StatusGroup) => g.user.id}
        refreshing={loading}
        onRefresh={refresh}
        ListHeaderComponent={
          profile ? (
            <>
              <Pressable style={styles.row} onPress={handleMyStatusPress}>
                <View style={[styles.ring, myStatuses.length > 0 && styles.ringViewed]}>
                  <Avatar name={profile.display_name} avatarUrl={profile.avatar_url} size={52} />
                  <Pressable
                    style={[styles.plusBadge, { backgroundColor: accentColors.accent }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push('/(app)/status/new');
                    }}
                    hitSlop={4}
                  >
                    <Text style={styles.plusGlyph}>+</Text>
                  </Pressable>
                </View>
                <View style={styles.rowTexts}>
                  <Text style={styles.rowName}>My status</Text>
                  <Text style={styles.rowSub}>
                    {myStatuses.length > 0 ? timeAgo(myStatuses[myStatuses.length - 1].created_at) : 'Tap to add status update'}
                  </Text>
                </View>
              </Pressable>
              {groups.length > 0 && <Text style={styles.sectionLabel}>Recent updates</Text>}
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/(app)/status/${item.user.id}`)}>
            <View
              style={[
                styles.ring,
                item.hasUnviewed ? { borderColor: accentColors.accent } : styles.ringViewed,
              ]}
            >
              <Avatar name={item.user.display_name} avatarUrl={item.user.avatar_url} size={52} />
            </View>
            <View style={styles.rowTexts}>
              <Text style={styles.rowName}>{item.user.display_name}</Text>
              <Text style={styles.rowSub}>{timeAgo(item.latestAt)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No recent updates from your contacts.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const RING_SIZE = 60;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  headerTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: fontWeight.heading,
  },
  addButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGlyph: {
    color: colors.text,
    fontSize: 20,
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[6],
    paddingVertical: space[3],
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringViewed: {
    borderColor: colors.neutral700,
  },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  plusGlyph: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    lineHeight: 14,
  },
  rowTexts: {
    flex: 1,
  },
  rowName: {
    color: colors.text,
    fontSize: 16,
  },
  rowSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: space[6],
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  empty: {
    padding: space[8],
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
});
