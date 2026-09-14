import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useStatuses, type StatusGroup } from '../../../lib/hooks/useStatuses';
import { Avatar } from '../../../components/Avatar';
import { PlusIcon } from '../../../components/icons';
import { useAccentTheme } from '../../../lib/accentTheme';
import { fontWeight, space } from '../../../lib/theme';
import { useTheme } from '../../../lib/themeMode';

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
  const theme = useTheme();
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
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Status</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/(app)/status/new')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add status update"
        >
          <PlusIcon size={20} color={theme.text} />
        </Pressable>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g: StatusGroup) => g.user.id}
        refreshing={loading}
        onRefresh={refresh}
        ListHeaderComponent={
          profile ? (
            <>
              <Pressable style={styles.row} onPress={handleMyStatusPress}>
                <View
                  style={[
                    styles.ring,
                    myStatuses.length > 0 && { borderColor: theme.neutral700 },
                  ]}
                >
                  <Avatar name={profile.display_name} avatarUrl={profile.avatar_url} size={52} />
                  <Pressable
                    style={[styles.plusBadge, { backgroundColor: accentColors.accent, borderColor: theme.bg }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push('/(app)/status/new');
                    }}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel="Add status update"
                  >
                    <PlusIcon size={13} color={theme.bg} strokeWidth={2.4} />
                  </Pressable>
                </View>
                <View style={styles.rowTexts}>
                  <Text style={[styles.rowName, { color: theme.text }]}>My status</Text>
                  <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                    {myStatuses.length > 0 ? timeAgo(myStatuses[myStatuses.length - 1].created_at) : 'Tap to add status update'}
                  </Text>
                </View>
              </Pressable>
              {groups.length > 0 && (
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Recent updates</Text>
              )}
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/(app)/status/${item.user.id}`)}>
            <View
              style={[
                styles.ring,
                { borderColor: item.hasUnviewed ? accentColors.accent : theme.neutral700 },
              ]}
            >
              <Avatar name={item.user.display_name} avatarUrl={item.user.avatar_url} size={52} />
            </View>
            <View style={styles.rowTexts}>
              <Text style={[styles.rowName, { color: theme.text }]}>{item.user.display_name}</Text>
              <Text style={[styles.rowSub, { color: theme.textMuted }]}>{timeAgo(item.latestAt)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No recent updates from your contacts.
              </Text>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: fontWeight.heading,
  },
  addButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  rowTexts: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
  },
  rowSub: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
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
    textAlign: 'center',
    fontSize: 14,
  },
});
