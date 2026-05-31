import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

export default function NewTruckTruck() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', plate: '', driver_name: '', driver_phone: '', is_active: true,
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Укажите название'); return; }
    setSaving(true);
    try {
      await api.truck.trucks.create(form);
      router.back();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Новая машина</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Добавить</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <F label="Название (марка, модель) *" value={form.name} onChange={v => set('name', v)} placeholder="МАЗ 555" />
        <F label="Гос. номер" value={form.plate} onChange={v => set('plate', v)} placeholder="АА 1234-7" />
        <F label="Водитель по умолчанию" value={form.driver_name} onChange={v => set('driver_name', v)} />
        <F label="Телефон водителя" value={form.driver_phone} onChange={v => set('driver_phone', v)} keyboardType="phone-pad" />
      </ScrollView>
    </View>
  );
}

function F({ label, value, onChange, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={String(value ?? '')} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.colors.textTertiary} keyboardType={keyboardType || 'default'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  saveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 60 },
  fieldRow: { marginBottom: 14 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 5 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },
});
