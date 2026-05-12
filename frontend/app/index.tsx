import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { getToken } from '../src/auth';
import { theme } from '../src/theme';

export default function Index() {
  const [status, setStatus] = useState<'loading' | 'auth' | 'noauth'>('loading');

  useEffect(() => {
    getToken()
      .then(token => setStatus(token ? 'auth' : 'noauth'))
      .catch(() => setStatus('noauth'));
  }, []);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (status === 'noauth') {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
