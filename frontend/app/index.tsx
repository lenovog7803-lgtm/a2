import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '../src/theme';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('jwt_token').then(token => {
      if (token) {
        router.replace('/(tabs)/dashboard' as any);
      } else {
        router.replace('/login' as any);
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
    </View>
  );
}
