import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { radius } from '../../../lib/theme';
import { useAccentTheme } from '../../../lib/accentTheme';
import { useThemeMode } from '../../../lib/themeMode';
import { ChatBubbleIcon, GearIcon, StatusRingIcon } from '../../../components/icons';

function AnimatedTabIcon({
  focused,
  pillColor,
  children,
}: {
  focused: boolean;
  pillColor: string;
  children: React.ReactNode;
}) {
  const pillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 180 }),
    transform: [{ scale: withTiming(focused ? 1 : 0.6, { duration: 180 }) }],
  }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.pill, pillStyle, { backgroundColor: pillColor }]} />
      {children}
    </View>
  );
}

export default function TabsLayout() {
  const { bg } = useThemeMode();
  const { colors } = useAccentTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: colors.divider,
        },
      }}
    >
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <AnimatedTabIcon focused={focused} pillColor={colors.accent800}>
              <StatusRingIcon size={22} color={color as string} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <AnimatedTabIcon focused={focused} pillColor={colors.accent800}>
              <ChatBubbleIcon size={22} color={color as string} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
            <AnimatedTabIcon focused={focused} pillColor={colors.accent800}>
              <GearIcon size={22} color={color as string} />
            </AnimatedTabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    width: 40,
    height: 34,
    borderRadius: radius.lg,
  },
});
