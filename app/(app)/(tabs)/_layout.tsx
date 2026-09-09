import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { ChatBubbleIcon, GearIcon, StatusRingIcon } from '../../../components/icons';
import { FloatingTabBar } from '../../../components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <StatusRingIcon size={22} color={color as string} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <ChatBubbleIcon size={22} color={color as string} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <GearIcon size={22} color={color as string} filled={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
