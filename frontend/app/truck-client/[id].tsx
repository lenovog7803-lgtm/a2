import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const FIELDS = [
  { key: 'name', label: 'Название' },
  { key: 'phone', label: 'Телефон', kb: 'phone-pad' },
  { key: 'email', label: 'Email', kb: 'email-address' },
  { key: 'city', label: 'Город' },
  { key: 'address', label: 'Адрес' },
  { key: 'unp', label: 'УНП' },
  { key: 'bank', label: 'Банк' },
  { key: 'rs', label: 'Расчётный счёт' },
  { key: 'bik', label: 'БИК' },
  { key: 'director', label: 'Директор' },
  { key: 'industry', label: 'Отрасль' },
];

export default function TruckClientDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    api.truck.clients.get(id!).then((d: any) => {
      setForm(d);
      setHistory(d.orders_history || []);
    }).catch(() => Alert.alert('Ошибка')).finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.truck.clients.update(id!, form);
      Alert.alert('Сохранено');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{form.name || 'Клиент'}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {FIELDS.map(f => (
          <View key={f.key} style={styles.fieldRow}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={styles.input}
              value={form[f.key] !== null && form[f.key] !== undefined ? String(form[f.key]) : ''}
              onChangeText={v => set(f.key, v)}
              keyboardType={(f as any).kb || 'default'}
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
        ))}
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Примечания</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.notes ?? ''} onChangeText={v => set('notes', v)} multiline placeholderTextColor={theme.colors.textTertiary} />
        </View>

        {history.length > 0 && (
          <View style={styles.historyBlock}>
            <Text style={styles.historyTitle}>ИСТОРИЯ ЗАЯВОК</Text>
            {history.map((o, i) => (
              <TouchableOpacity key={i} style={styles.historyRow} onPress={() => router.push(`/truck-order/${o.id}`)}>
                <MapPin size={12} color={theme.colors.accent} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.historyOrder}>{o.order_number || '—'}</Text>
                  <Text style={styles.historyRoute}>
                    {o.city_loading && o.city_unloading ? `${o.city_loading} → ${o.city_unloading}` : '—'}
                  </Text>
                  <Text style={styles.historyDate}>{(o.created_at || '').slice(0, 10)}</Text>
                </View>
                <Text style={styles.historyRate}>{formatMoney(o.rate_client ?? 0)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
  fieldRow: { marginBottom: 12 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },
  historyBlock: { marginTop: 8, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  historyTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  historyOrder: { fontSize: 13, fontWeight: '700', color: theme.colors.accent },
  historyRoute: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  historyDate: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  historyRate: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
});
