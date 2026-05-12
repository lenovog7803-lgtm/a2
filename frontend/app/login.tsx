import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://logistics-crm-backend.onrender.com';

export default function Login() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError('Неверный логин или пароль'); return; }
      await AsyncStorage.setItem('jwt_token', data.token);
      await AsyncStorage.setItem('user_role', data.user?.role ?? 'manager');
      router.replace('/(tabs)/dashboard' as any);
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход в CRM</Text>
      <TextInput style={styles.input} placeholder="Логин" value={login} onChangeText={setLogin} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Пароль" value={password} onChangeText={setPassword} secureTextEntry />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Войти</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F1EB' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 32, color: '#1A1A1A' },
  input: { width: '100%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E0D8', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, color: '#1A1A1A' },
  error: { color: 'red', marginBottom: 8 },
  btn: { width: '100%', backgroundColor: '#B8840A', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
