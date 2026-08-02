import * as Location from 'expo-location';
import { supabase } from './supabase';
import { LOCATION_TASK_NAME, setActiveShareId } from './locationTask';
import type { LiveLocationDuration } from './database.types';

function expiresAtFor(duration: LiveLocationDuration): string | null {
  const now = Date.now();
  if (duration === '15m') return new Date(now + 15 * 60 * 1000).toISOString();
  if (duration === '24h') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  return null;
}

// Starts a live location share: creates the tracking row + an announcement
// message, then hands continued position updates to a background task so
// they keep flowing even while the app isn't in the foreground.
export async function startLiveLocationShare(
  chatId: string,
  userId: string,
  duration: LiveLocationDuration
): Promise<string | null> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return null;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return null;

  const position = await Location.getCurrentPositionAsync({});

  const { data: row, error } = await supabase
    .from('live_locations')
    .insert({
      chat_id: chatId,
      user_id: userId,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      expires_at: expiresAtFor(duration),
    })
    .select()
    .single();
  if (error || !row) throw error ?? new Error('Failed to start live location');

  const { error: msgError } = await supabase
    .from('messages')
    .insert({ chat_id: chatId, sender_id: userId, body: null, location_share_id: row.id });
  if (msgError) {
    await supabase.from('live_locations').delete().eq('id', row.id);
    throw msgError;
  }

  await setActiveShareId(row.id);
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60000,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'NestChat',
      notificationBody: 'Sharing your live location',
    },
  });

  return row.id as string;
}

export async function stopLiveLocationShare(liveLocationId: string) {
  await supabase
    .from('live_locations')
    .update({ stopped_at: new Date().toISOString() })
    .eq('id', liveLocationId);
  await setActiveShareId(null);
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
}
