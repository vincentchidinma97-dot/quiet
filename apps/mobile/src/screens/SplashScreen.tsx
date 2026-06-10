import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, SafeAreaView,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withRepeat, withSequence,
  Easing,
} from 'react-native-reanimated'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>

const EASE_OUT_EXPO = Easing.bezier(0.22, 1, 0.36, 1)

export function SplashScreen({ navigation }: Props) {
  const haptic        = useHaptic()
  const { colors, mode } = useTheme()
  const styles        = getStyles(colors)

  const logoOpacity  = useSharedValue(0)
  const logoY        = useSharedValue(40)
  const taglineOp    = useSharedValue(0)
  const taglineSpace = useSharedValue(Typography.tracking.widest * 4)
  const dividerScale = useSharedValue(0)
  const dividerGlow  = useSharedValue(1)
  const actionsOp    = useSharedValue(0)
  const actionsY     = useSharedValue(20)
  const footerOp     = useSharedValue(0)

  useEffect(() => {
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 1200, easing: EASE_OUT_EXPO }))
    logoY.value       = withDelay(200, withTiming(0, { duration: 1200, easing: EASE_OUT_EXPO }))

    taglineOp.value    = withDelay(600, withTiming(1, { duration: 800,  easing: Easing.out(Easing.ease) }))
    taglineSpace.value = withDelay(600, withTiming(
      Typography.tracking.widest * 1.2,
      { duration: 1000, easing: Easing.out(Easing.cubic) },
    ))

    dividerScale.value = withDelay(1100, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }))

    dividerGlow.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1,   { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    )

    actionsOp.value = withDelay(1900, withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) }))
    actionsY.value  = withDelay(1900, withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) }))
    footerOp.value  = withDelay(2100, withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }))
  }, [])

  const logoStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ translateY: logoY.value }],
  }))

  const taglineStyle = useAnimatedStyle(() => ({
    opacity:       taglineOp.value,
    letterSpacing: taglineSpace.value,
  }))

  const dividerStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: dividerScale.value }],
    opacity:   dividerGlow.value,
  }))

  const actionsStyle = useAnimatedStyle(() => ({
    opacity:   actionsOp.value,
    transform: [{ translateY: actionsY.value }],
  }))

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOp.value,
  }))

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={mode === 'paper' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.bg}
      />
      <View style={styles.container}>

        <View style={styles.hero}>
          <Animated.View style={logoStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.logo}>quiet</Text>
              <Text style={[styles.logo, { color: colors.accent }]}>.</Text>
            </View>
          </Animated.View>

          <Animated.Text style={[styles.tagline, taglineStyle]}>
            private correspondence
          </Animated.Text>

          <Animated.View style={[styles.divider, dividerStyle]} />
        </View>

        <Animated.View style={[styles.actions, actionsStyle]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { haptic.medium(); navigation.navigate('ConnectWallet') }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>connect wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => { haptic.medium(); navigation.navigate('ConnectWallet') }}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostBtnText}>import existing key</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            no account · no email · no name{'\n'}your wallet is your identity
          </Text>
        </Animated.View>

        <Animated.View style={[styles.footer, footerStyle]}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>end-to-end encrypted · non-custodial · open-source</Text>
        </Animated.View>

      </View>
    </SafeAreaView>
  )
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing['8'],
    },
    hero: {
      alignItems: 'center',
      marginBottom: Spacing['12'],
    },
    logo: {
      fontFamily:   Typography.serif,
      fontSize:     Typography.size['4xl'],
      color:        colors.textPrimary,
      letterSpacing: 0,
      marginBottom: Spacing['2'],
    },
    tagline: {
      fontFamily:    Typography.mono,
      fontSize:      Typography.size.xs,
      color:         colors.textTertiary,
      textTransform: 'uppercase',
      marginBottom:  Spacing['6'],
    },
    divider: {
      width:           40,
      height:          1.5,
      backgroundColor: colors.accent,
    },
    actions: {
      width:        '100%',
      gap:          Spacing['3'],
      marginBottom: Spacing['10'],
    },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius:    Radius.lg,
      paddingVertical: Spacing['4'] - 1,
      alignItems:      'center',
    },
    primaryBtnText: {
      fontFamily:    Typography.sans,
      fontSize:      Typography.size.md,
      fontWeight:    Typography.weight.medium,
      color:         colors.bg,
      letterSpacing: Typography.tracking.wide,
    },
    ghostBtn: {
      backgroundColor: 'transparent',
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      paddingVertical: Spacing['4'] - 1,
      alignItems:      'center',
    },
    ghostBtnText: {
      fontFamily:    Typography.sans,
      fontSize:      Typography.size.base,
      color:         colors.textSecondary,
      letterSpacing: Typography.tracking.wide,
    },
    note: {
      textAlign:     'center',
      fontFamily:    Typography.mono,
      fontSize:      Typography.size.xs,
      color:         colors.textTertiary,
      lineHeight:    Typography.size.xs * Typography.leading.loose,
      marginTop:     Spacing['2'],
      letterSpacing: Typography.tracking.wide,
    },
    footer: {
      position:      'absolute',
      bottom:        Spacing['6'],
      flexDirection: 'row',
      alignItems:    'center',
      gap:           Spacing['2'],
    },
    footerDot: {
      width:           6,
      height:          6,
      borderRadius:    Radius.full,
      backgroundColor: colors.success,
    },
    footerText: {
      fontFamily:    Typography.mono,
      fontSize:      Typography.size.xs,
      color:         colors.textTertiary,
      letterSpacing: Typography.tracking.wide,
    },
  })
}
