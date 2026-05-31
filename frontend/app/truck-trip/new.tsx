import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

const STATUSES = ['новая', 'забрали', 'доставлено'];

export default function NewTruckTrip() {
  const router = useRouter();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    truck_id: '', truck_name: '', driver_name: '', driver_phone: '',
    date_loading: '', date_unloading: '', mileage: '',
    status: 'новая', notes: '',
  });

  useEffect(() => {
    api.truck.trucks.list().then((d: any) => setTrucks(d)).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const selectTruck = (t: any) => {
    set('truck_id', t.id); set('truck_name', t.name || '');
    set('driver_name', t.driver_name || ''); set('driver_phone', t.driver_phone || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, mileage: form.mileage ? Number(form.mileage) : 0 };
      const trip = await api.truck.trips.create(payload) as any;
      router.replace(`/truck-trip/${trip.id}`);
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Новый рейс</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Создать</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <S title="Машина">
          {trucks.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {trucks.map(t => (
                  <TouchableOpacity key={t.id} style={[styles.chip, form.truck_id === t.id && styles.chipActive]} onPress={() => selectTruck(t)}>
                    <Text style={[styles.chipText, form.truck_id === t.id && styles.chipTextActive]}>{t.name} · {t.plate}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.hint}>Нет машин — добавьте в Финансы → Машины</Text>
          )}
          <F label="Водитель" value={form.driver_name} onChange={v => set('driver_name', v)} />
        </S>
        <S title="Даты и пробег">
          <F label="Дата погрузки" value={form.date_loading} onChange={v => set('date_loading', v)} placeholder="2026-06-01" />
          <F label="Дата разгрузки" value={form.date_unloading} onChange={v => set('date_unloading', v)} placeholder="2026-06-03" />
          <F label="Пробег, км" value={form.mileage} onChange={v => set('mileage', v)} keyboardType="numeric" />
        </S>
        <S title="Статус">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {STATUSES.map(s => (
                <TouchableOpacity key={s} style={[styles.chip, form.status === s && styles.chipActive]} onPress={() => set('status', s)}>
                  <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </S>
        <S title="Примечания">
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={form.notes} onChangeText={v => set('notes', v)} multiline placeholderTextColor={theme.colors.textTertiary} />
        </S>
      </ScrollView>
    </View>
  );
}

function S({ title, children }: any) { return <View style={styles.sec}><Text style={styles.secTitle}>{title}</Text>{children}</View>; }
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
  sec: { marginBottom: 24 },
  secTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  fieldRow: { marginBottom: 10 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  hint: { fontSize: 13, color: theme.colors.textTertiary, marginBottom: 8 },
});
