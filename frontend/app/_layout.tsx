import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/themeContext';
import { useFonts } from 'expo-font';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold } from '@expo-google-fonts/onest';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Onest_600SemiBold,
    Onest_700Bold,
    Onest_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Don't block render on fonts — show app immediately, fonts progressively applied
  return (
    <ThemeProvider>
      {(mode) => (
        <Stack key={mode} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="order/[id]" />
          <Stack.Screen name="order/new" />
          <Stack.Screen name="client/new" />
          <Stack.Screen name="client/[id]" />
          <Stack.Screen name="carrier/new" />
          <Stack.Screen name="carrier/[id]" />
          <Stack.Screen name="lead/new" />
          <Stack.Screen name="lead/[id]" />
          <Stack.Screen name="task/[id]" />
          <Stack.Screen name="trash" />
        </Stack>
      )}
    </ThemeProvider>
  );
}
