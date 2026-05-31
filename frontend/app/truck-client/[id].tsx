import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

export default function TruckClientDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    api.truck.clients.get(id!).then((d: any) => setForm(d)).catch(() => Alert.alert('Ошибка')).finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, typical_pallets: form.typical_pallets ? Number(form.typical_pallets) : 0 };
      await api.truck.clients.update(id!, payload);
      Alert.alert('Сохранено');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>{form.name || 'Клиент'}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Название" value={form.name} onChangeText={v => set('name', v)} />
        <Field label="Контактное лицо" value={form.contact_person} onChangeText={v => set('contact_person', v)} />
        <Field label="Телефон" value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" />
        <Field label="Email" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" />
        <Field label="Город загрузки" value={form.city_loading} onChangeText={v => set('city_loading', v)} />
        <Field label="Город выгрузки" value={form.city_unloading} onChangeText={v => set('city_unloading', v)} />
        <Field label="Типичный груз" value={form.typical_cargo} onChangeText={v => set('typical_cargo', v)} />
        <Field label="Кол-во паллет" value={form.typical_pallets} onChangeText={v => set('typical_pallets', v)} keyboardType="numeric" />
        <Field label="Условия оплаты" value={form.payment_terms} onChangeText={v => set('payment_terms', v)} />
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

function Field({ label, value, onChangeText, keyboardType }: any) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value !== null && value !== undefined ? String(value) : ''}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        placeholderTextColor={theme.colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary, flex: 1, marginHorizontal: 8 },
  saveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 60 },
  fieldRow: { marginBottom: 12 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.textPrimary,
  },
});
