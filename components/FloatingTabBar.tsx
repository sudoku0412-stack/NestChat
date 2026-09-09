import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../lib/themeMode';
import { fontWeight, radius, space } from '../lib/theme';

const INDICATOR_SPRING = { damping: 18, stiffness: 220 };

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const segmentWidth = barWidth > 0 ? (barWidth - space[1] * 2) / state.routes.length : 0;
  const translateX = useSharedValue(state.index * segmentWidth);
  const width = useSharedValue(segmentWidth);
  const hasMeasured = useRef(false);

  useEffect(() => {
    if (segmentWidth === 0) return;
    if (!hasMeasured.current) {
      hasMeasured.current = true;
      translateX.value = state.index * segmentWidth;
      width.value = segmentWidth;
      return;
    }
    translateX.value = withSpring(state.index * segmentWidth, INDICATOR_SPRING);
    width.value = withSpring(segmentWidth, INDICATOR_SPRING);
  }, [state.index, segmentWidth, translateX, width]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: width.value,
    transform: [{ translateX: translateX.value }],
  }));

  function handleLayout(e: LayoutChangeEvent) {
    setBarWidth(e.nativeEvent.layout.width);
  }

  return (
    <View
      style={[
        styles.wrap,
        { paddingHorizontal: space[4], paddingBottom: insets.bottom + space[3] },
      ]}
    >
      <View
        onLayout={handleLayout}
        style={[
          styles.bar,
          { backgroundColor: theme.surface, borderColor: theme.divider },
        ]}
      >
        {segmentWidth > 0 ? (
          <Animated.View
            style={[styles.indicator, indicatorStyle, { backgroundColor: theme.accent }]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const tintColor = focused ? '#fff' : theme.textMuted;

          function handlePress() {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={handlePress}
              accessibilityRole={Platform.select({ ios: 'button', default: 'tab' })}
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? String(label)}
              style={styles.tab}
            >
              {options.tabBarIcon?.({ focused, color: tintColor, size: 22 })}
              <Text style={[styles.label, { color: tintColor }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: space[2],
  },
  bar: {
    height: 64,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space[1],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  indicator: {
    position: 'absolute',
    top: space[1],
    left: space[1],
    bottom: space[1],
    borderRadius: radius.full,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
});
