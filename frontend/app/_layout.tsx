import React from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/themeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      {(mode) => (
        <Stack key={mode} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(truck)" />
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
          <Stack.Screen name="truck-trip/new" />
          <Stack.Screen name="truck-trip/[id]" />
          <Stack.Screen name="truck-client/new" />
          <Stack.Screen name="truck-client/[id]" />
          <Stack.Screen name="truck-route/new" />
          <Stack.Screen name="truck-route/[id]" />
          <Stack.Screen name="truck-truck/new" />
          <Stack.Screen name="truck-truck/[id]" />
        </Stack>
      )}
    </ThemeProvider>
  );
}
