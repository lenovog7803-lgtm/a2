import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Platform } from 'react-native';
import { ThemeProvider } from '../src/themeContext';
import { theme, applyTheme, bootstrapTheme } from '../src/theme';
import { getToken } from '../src/auth';

bootstrapTheme();

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/login' as any);
      }
    })();
  }, []);

  return (
    <ThemeProvider>
      {(mode) => (
        <GestureHandlerRootView key={mode} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <SafeAreaProvider>
            <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
              <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.colors.bg },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" options={{ presentation: 'card', animation: 'fade' }} />
                <Stack.Screen name="order/[id]" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="order/new" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="client/new" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="client/[id]" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="carrier/new" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="carrier/[id]" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="lead/new" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
              </Stack>
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      )}
    </ThemeProvider>
  );
}
