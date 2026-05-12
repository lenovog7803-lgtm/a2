import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { getToken, clearAuth, saveAuth } from '../src/auth';
import { api } from '../src/api';
import { theme } from '../src/theme';

export default function Index() {
  const [status, setStatus] = useState<'loading' | 'auth' | 'noauth'>('loading');

  useEffect(() => {
    (async () => {
      // Step 1: check AsyncStorage for token
      const token = await getToken();
      if (!token) {
        setStatus('noauth');
        return;
      }

      // Step 2: validate token with server via GET /api/auth/me
      try {
        const user = await api.auth.me();
        // Refresh stored user data in case it changed
        await saveAuth(token, user);
        setStatus('auth');
      } catch (e: any) {
        const msg = e?.message ?? '';
        if (msg === 'Unauthorized' || msg.includes('401')) {
          // Token invalid — clear and redirect to login
          await clearAuth();
          setStatus('noauth');
        } else {
          // Network error or server down — trust cached token
          setStatus('auth');
        }
      }
    })();
  }, []);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  if (status === 'noauth') {
    return <Redirect href={'/login' as any} />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
