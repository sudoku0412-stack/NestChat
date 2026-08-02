// Registers the background location task at module load — this file must be
// imported once, early (see app/_layout.tsx), before iOS/Android can deliver
// a background location update to a task name it doesn't recognize yet.
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const LOCATION_TASK_NAME = 'nestchat-live-location';
const ACTIVE_SHARE_KEY = 'nestchat:activeLiveLocationId';

export async function setActiveShareId(id: string | null) {
  if (id) await AsyncStorage.setItem(ACTIVE_SHARE_KEY, id);
  else await AsyncStorage.removeItem(ACTIVE_SHARE_KEY);
}

export async function getActiveShareId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_SHARE_KEY);
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const activeId = await getActiveShareId();
  if (!activeId) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    return;
  }

  const { data: row } = await supabase
    .from('live_locations')
    .select('stopped_at, expires_at')
    .eq('id', activeId)
    .single();

  const expired = !!row?.expires_at && new Date(row.expires_at) <= new Date();
  if (!row || row.stopped_at || expired) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    await setActiveShareId(null);
    if (row && !row.stopped_at) {
      await supabase
        .from('live_locations')
        .update({ stopped_at: new Date().toISOString() })
        .eq('id', activeId);
    }
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  await supabase
    .from('live_locations')
    .update({
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeId);
});
