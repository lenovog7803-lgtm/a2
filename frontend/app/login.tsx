import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../src/theme';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!login.trim() || !password.trim()) {
      setError('Заполните логин и пароль');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });

      if (res.status === 401 || res.status === 400) {
        setError('Неверный логин или пароль');
        return;
      }
      if (!res.ok) {
        setError('Ошибка сервера. Попробуйте позже.');
        return;
      }

      const data = await res.json();
      // Сохраняем токен и роль в AsyncStorage
      await AsyncStorage.setItem('jwt_token', data.token);
      await AsyncStorage.setItem('user_role', data.user?.role ?? 'manager');
      await AsyncStorage.setItem('user_data', JSON.stringify(data.user));

      router.replace('/(tabs)/dashboard' as any);
    } catch {
      setError('Нет соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: "#F5F1EB" }}
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
              onChangeText={v => { setLogin(v); setError(''); }}
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
              onChangeText={v => { setPassword(v); setError(''); }}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textTertiary}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

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
  form: { gap: 14 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: theme.colors.textPrimary, fontSize: 15,
  },
  error: {
    color: theme.colors.loss,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: theme.colors.accent, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: '#000', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
