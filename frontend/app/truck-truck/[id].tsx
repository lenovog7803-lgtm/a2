import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

export default function TruckTruckDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL ?? ''}/api/truck/trucks`)
      .then(r => r.json())
      .then((trucks: any[]) => {
        const t = trucks.find(x => x.id === id);
        if (t) setForm(t);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.truck.trucks.update(id!, form);
      Alert.alert('Сохранено');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  const remove = () => {
    Alert.alert('Удалить машину?', form.name, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.truck.trucks.remove(id!);
        router.back();
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>{form.name || 'Машина'}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={remove} style={{ marginLeft: 8 }}><Trash2 size={18} color={theme.colors.loss} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <F label="Название" value={form.name} onChange={v => set('name', v)} />
        <F label="Гос. номер" value={form.plate} onChange={v => set('plate', v)} />
        <F label="Водитель" value={form.driver_name} onChange={v => set('driver_name', v)} />
        <F label="Телефон водителя" value={form.driver_phone} onChange={v => set('driver_phone', v)} keyboardType="phone-pad" />
      </ScrollView>
    </View>
  );
}

function F({ label, value, onChange, keyboardType }: any) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value !== null && value !== undefined ? String(value) : ''} onChangeText={onChange} keyboardType={keyboardType || 'default'} placeholderTextColor={theme.colors.textTertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary, flex: 1, marginHorizontal: 8 },
  saveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 60 },
  fieldRow: { marginBottom: 14 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 5 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },
});
