import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'nestchat.recentEmojis';
const MAX_STORED = 9;
const DEFAULT_RECENTS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export async function getRecentEmojis(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RECENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RECENTS;
  } catch {
    return DEFAULT_RECENTS;
  }
}

// Most-recently-used first, deduped, capped at MAX_STORED -- called from the single place every
// reaction path (quick-bar tap, full emoji picker, tapping an existing reaction pill) funnels
// through, so the list stays accurate regardless of which UI triggered it.
export async function addRecentEmoji(emoji: string): Promise<void> {
  try {
    const current = await getRecentEmojis();
    const next = [emoji, ...current.filter((e) => e !== emoji)].slice(0, MAX_STORED);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort -- losing the recent-emoji list isn't worth surfacing an error for.
  }
}
