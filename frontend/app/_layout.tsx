import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Platform } from 'react-native';
import { ThemeProvider } from '../src/themeContext';
import { theme, applyTheme, bootstrapTheme } from '../src/theme';

// Синхронный bootstrap темы — должен выполниться ДО рендера дочерних экранов.
bootstrapTheme();

export default function RootLayout() {
  return (
    <ThemeProvider>
      {(mode) => (
        // key={mode} — заставляет всё дерево перемонтироваться при переключении темы,
        // чтобы StyleSheet.create пересчитал цвета.
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
