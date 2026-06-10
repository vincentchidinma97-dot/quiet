import React, { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Typography, Spacing, BorderWidth, Radius } from '../theme'
import type { ThemeColors } from '../theme'
import type { MainTabParamList, InboxStackParamList } from './types'
import { useTheme } from '../hooks/useTheme'

import { InboxScreen }       from '../screens/InboxScreen'
import { DMScreen }          from '../screens/DMScreen'
import { PortfolioScreen }   from '../screens/PortfolioScreen'
import { SendPaymentScreen } from '../screens/SendPaymentScreen'
import { SettingsScreen }    from '../screens/SettingsScreen'

function Placeholder({ name }: { name: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: Typography.serif, fontSize: 18, color: colors.accent }}>{name}</Text>
      <Text style={{ fontFamily: Typography.mono, fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
        coming in next build
      </Text>
    </View>
  )
}

// ── Inbox stack ───────────────────────────────────────────────────────────────
const InboxStack = createNativeStackNavigator<InboxStackParamList>()

function InboxNavigator() {
  return (
    <InboxStack.Navigator screenOptions={{ headerShown: false }}>
      <InboxStack.Screen name="InboxList"   component={InboxScreen} />
      <InboxStack.Screen name="DM"          component={DMScreen} />
      <InboxStack.Screen name="SendPayment" component={SendPaymentScreen} />
      <InboxStack.Screen name="NewMessage"  component={() => <Placeholder name="new message" />} />
      <InboxStack.Screen name="Room"        component={() => <Placeholder name="trading room" />} />
      <InboxStack.Screen name="TokenDetail" component={() => <Placeholder name="token detail" />} />
      <InboxStack.Screen name="RoomCreate"  component={() => <Placeholder name="create room" />} />
      <InboxStack.Screen name="RoomInvite"  component={() => <Placeholder name="invite" />} />
    </InboxStack.Navigator>
  )
}

// ── Tab icon with glow + scale animation ─────────────────────────────────────
const Tab = createBottomTabNavigator<MainTabParamList>()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const { colors } = useTheme()
  const icons: Record<string, string> = {
    Inbox:     '✉',
    Portfolio: '◈',
    Trade:     '⚡',
    Settings:  '◎',
  }

  const scale         = useSharedValue(focused ? 1.1 : 1.0)
  const shadowOpacity = useSharedValue(focused ? 0.4 : 0)

  useEffect(() => {
    scale.value         = withTiming(focused ? 1.1 : 1.0, { duration: 200, easing: Easing.out(Easing.ease) })
    shadowOpacity.value = withTiming(focused ? 0.4 : 0,   { duration: 200, easing: Easing.out(Easing.ease) })
  }, [focused])

  const animStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: scale.value }],
    shadowColor:   colors.accent,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: shadowOpacity.value,
    shadowRadius:  8,
  }))

  return (
    <Animated.View style={animStyle}>
      <Text style={{ fontSize: 18, color: focused ? colors.accent : colors.textTertiary }}>
        {icons[name] ?? '·'}
      </Text>
    </Animated.View>
  )
}

export function MainNavigator() {
  const { colors } = useTheme()
  const styles = getStyles(colors)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle:        styles.tabLabel,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Inbox"     component={InboxNavigator} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Trade"     component={() => <Placeholder name="trade" />} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  )
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: colors.surfaceAlt,
      borderTopWidth:  BorderWidth.hairline,
      borderTopColor:  colors.border,
      paddingBottom:   Spacing['2'],
      paddingTop:      Spacing['1'],
      height:          60,
    },
    tabLabel: {
      fontFamily:    Typography.mono,
      fontSize:      Typography.size.xs,
      letterSpacing: Typography.tracking.wide,
    },
  })
}
