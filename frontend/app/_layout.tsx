import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '../src/themeContext';
import { theme, bootstrapTheme } from '../src/theme';

bootstrapTheme();

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

export default function RootLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Читаем токен из AsyncStorage
        const token = await AsyncStorage.getItem('jwt_token');

        if (!token) {
          // Токена нет — на логин
          router.replace('/login' as any);
          setChecking(false);
          return;
        }

        // Токен есть — проверяем через GET /api/auth/me
        try {
          const res = await fetch(`${BASE}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (res.status === 401) {
            // Токен невалидный — удаляем и на логин
            await AsyncStorage.multiRemove(['jwt_token', 'user_role', 'user_data']);
            router.replace('/login' as any);
          } else {
            // Токен валидный — на дашборд
            router.replace('/(tabs)/dashboard' as any);
          }
        } catch {
          // Сервер недоступен — доверяем кешированному токену
          router.replace('/(tabs)/dashboard' as any);
        }
      } catch {
        router.replace('/login' as any);
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

              {/* Overlay пока идёт проверка авторизации */}
              {checking && (
                <View style={styles.overlay}>
                  <ActivityIndicator color={theme.colors.accent} size="large" />
                </View>
              )}
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
