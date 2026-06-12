import React, { useMemo } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { PrivyProvider } from '@privy-io/expo'
import { sepolia } from 'viem/chains'
import { SplashScreen }        from './screens/SplashScreen'
import { ConnectWalletScreen } from './screens/ConnectWalletScreen'
import { MainNavigator }       from './navigation/MainNavigator'
import { useWalletStore }      from './store/walletStore'
import { useTheme }            from './hooks/useTheme'
import { ThemeTransition }     from './components/ThemeTransition'
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from './services/privyConfig'
import { XmtpProvider } from './contexts/XmtpContext'
import type { RootStackParamList } from './navigation/types'

const Stack = createNativeStackNavigator<RootStackParamList>()

function AppInner() {
  const isConnected      = useWalletStore((s) => s.isConnected)
  const { colors, mode } = useTheme()

  const navTheme = useMemo(() => ({
    dark: mode === 'eclipse',
    colors: {
      primary:      colors.accent,
      background:   colors.bg,
      card:         colors.surfaceAlt,
      text:         colors.textPrimary,
      border:       colors.border,
      notification: colors.accent,
    },
  }), [colors, mode])

  return (
    <ThemeTransition>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{ headerShown: false, animation: 'fade' }}
          initialRouteName={isConnected ? 'Main' : 'Splash'}
        >
          <Stack.Screen name="Splash"        component={SplashScreen} />
          <Stack.Screen name="ConnectWallet" component={ConnectWalletScreen} />
          <Stack.Screen name="Main"          component={MainNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeTransition>
  )
}

export default function App() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      supportedChains={[sepolia]}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <XmtpProvider>
        <AppInner />
      </XmtpProvider>
    </PrivyProvider>
  )
}
