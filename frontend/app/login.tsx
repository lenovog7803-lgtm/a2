import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

export default function Login() {
  const router = useRouter();
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
      style={styles.container}
    >
      <View style={[styles.inner, { paddingTop: 60, paddingBottom: 40 }]}>
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
              placeholderTextColor="#999999"
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
              placeholderTextColor="#999999"
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
  container: { flex: 1, backgroundColor: '#F5F1EB' },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { marginBottom: 40, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#B8840A', letterSpacing: -1 },
  subtitle: { fontSize: 14, color: '#999999', marginTop: 6 },
  form: { gap: 14 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#999999' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E0D8',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#1A1A1A', fontSize: 15,
  },
  error: {
    color: '#E53935',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#B8840A', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: '#000', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
