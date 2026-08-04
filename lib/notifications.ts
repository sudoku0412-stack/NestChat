import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerAndStoreToken(userId: string) {
  if (!Device.isDevice) {
    // Push tokens aren't issued on simulators/emulators.
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  await supabase.from('users').update({ push_token: token.data }).eq('id', userId);
}

export function usePushNotificationRegistration(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    registerAndStoreToken(userId).catch((err) => {
      console.warn('Failed to register push token', err);
    });
  }, [userId]);
}

function openChatFromResponse(
  router: ReturnType<typeof useRouter>,
  response: Notifications.NotificationResponse | null
) {
  const chatId = response?.notification.request.content.data?.chatId;
  if (typeof chatId === 'string') {
    router.push(`/(app)/chat/${chatId}`);
  }
}

// Handles both cold-start (app launched by tapping a notification) and
// foreground/background taps while the app is already running.
export function usePushNotificationNavigation() {
  const router = useRouter();

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      openChatFromResponse(router, response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openChatFromResponse(router, response);
    });

    return () => subscription.remove();
  }, [router]);
}
