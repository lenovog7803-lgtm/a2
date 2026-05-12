import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { ThemeProvider } from '../src/themeContext';
import { theme, bootstrapTheme } from '../src/theme';

bootstrapTheme();

export default function RootLayout() {
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
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
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
