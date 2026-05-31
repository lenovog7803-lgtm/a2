import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

const FIELDS = [
  { key: 'name', label: 'Название *', required: true },
  { key: 'phone', label: 'Телефон', kb: 'phone-pad' },
  { key: 'email', label: 'Email', kb: 'email-address' },
  { key: 'city', label: 'Город' },
  { key: 'address', label: 'Адрес' },
  { key: 'unp', label: 'УНП' },
  { key: 'bank', label: 'Банк' },
  { key: 'rs', label: 'Расчётный счёт' },
  { key: 'bik', label: 'БИК' },
  { key: 'director', label: 'Директор / подписант' },
  { key: 'industry', label: 'Отрасль' },
];

export default function NewTruckClient() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name?.trim()) { Alert.alert('Укажите название'); return; }
    setSaving(true);
    try {
      await api.truck.clients.create(form);
      router.back();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Новый клиент</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Создать</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {FIELDS.map(f => (
          <View key={f.key} style={styles.fieldRow}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={styles.input}
              value={form[f.key] ?? ''}
              onChangeText={v => set(f.key, v)}
              keyboardType={(f as any).kb || 'default'}
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
        ))}
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Примечания</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={form.notes ?? ''}
            onChangeText={v => set('notes', v)}
            multiline
            placeholderTextColor={theme.colors.textTertiary}
          />
        </View>
      </ScrollView>
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
  fieldRow: { marginBottom: 12 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: theme.colors.textPrimary },
});
