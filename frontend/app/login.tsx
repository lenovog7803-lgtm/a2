import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../src/api';
import { TOKEN_KEY, ROLE_KEY, USER_KEY } from '../src/auth';
import { theme } from '../src/theme';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!login.trim() || !password.trim()) {
      Alert.alert('Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      const result = await api.auth.login(login.trim(), password);
      // Save token, role and full user separately
      await AsyncStorage.setItem(TOKEN_KEY, result.token);
      await AsyncStorage.setItem(ROLE_KEY, result.user?.role ?? 'manager');
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(result.user));
      router.replace('/(tabs)/dashboard' as any);
    } catch (e: any) {
      const msg = e?.message ?? '';
      const isBadCreds = msg === 'Unauthorized' || msg.includes('401');
      Alert.alert('Ошибка входа', isBadCreds ? 'Неверный логин или пароль' : (msg || 'Ошибка сервера'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>CRM</Text>
          <Text style={styles.subtitle}>Войдите чтобы продолжить</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>ЛОГИН</Text>
            <TextInput
              style={styles.input}
              value={login}
              onChangeText={setLogin}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="admin"
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>ПАРОЛЬ</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textTertiary}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.btn, loading && { opacity: 0.6 }]}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnText}>Войти</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.accent, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: theme.colors.textTertiary, marginTop: 6 },
  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: theme.colors.textPrimary, fontSize: 15,
  },
  btn: {
    backgroundColor: theme.colors.accent, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#000', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
