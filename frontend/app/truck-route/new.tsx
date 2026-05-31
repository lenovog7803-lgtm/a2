import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

const PAY_STATUSES = ['не оплачен', 'частично', 'оплачен'];

export default function NewTruckRoute() {
  const router = useRouter();
  const { trip_id } = useLocalSearchParams<{ trip_id: string }>();
  const [clients, setClients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    client_id: '',
    client_name: '',
    route: '',
    city_loading: '',
    city_unloading: '',
    date_loading: '',
    date_unloading: '',
    cargo_type: '',
    cargo_weight: '',
    pallets: '',
    volume: '',
    rate_client: '',
    payment_client_status: 'не оплачен',
    documents_sent: false,
    documents_received: false,
    notes: '',
  });

  useEffect(() => {
    api.truck.clients.list().then((d: any) => setClients(d)).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const selectClient = (c: any) => {
    set('client_id', c.id);
    set('client_name', c.name);
  };

  const buildRoute = (from: string, to: string) => {
    const r = [from, to].filter(Boolean).join(' → ');
    if (r) set('route', r);
  };

  const save = async () => {
    if (!trip_id) { Alert.alert('Нет trip_id'); return; }
    setSaving(true);
    try {
      const payload: any = { ...form };
      ['cargo_weight', 'pallets', 'volume', 'rate_client'].forEach(k => {
        if (payload[k] !== '') payload[k] = Number(payload[k]);
      });
      await api.truck.routes.create(trip_id, payload);
      router.back();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Новый маршрут</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Добавить</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Sec title="Клиент">
          {clients.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {clients.map(c => (
                  <TouchableOpacity key={c.id} style={[styles.chip, form.client_id === c.id && styles.chipActive]} onPress={() => selectClient(c)}>
                    <Text style={[styles.chipText, form.client_id === c.id && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          <F label="Название клиента" value={form.client_name} onChange={v => set('client_name', v)} />
        </Sec>

        <Sec title="Маршрут">
          <F label="Маршрут (итоговый)" value={form.route} onChange={v => set('route', v)} placeholder="Минск → Москва" />
          <F label="Город загрузки" value={form.city_loading} onChange={v => { set('city_loading', v); buildRoute(v, form.city_unloading); }} />
          <F label="Город выгрузки" value={form.city_unloading} onChange={v => { set('city_unloading', v); buildRoute(form.city_loading, v); }} />
          <F label="Дата загрузки" value={form.date_loading} onChange={v => set('date_loading', v)} placeholder="2026-06-01" />
          <F label="Дата выгрузки" value={form.date_unloading} onChange={v => set('date_unloading', v)} placeholder="2026-06-02" />
        </Sec>

        <Sec title="Груз">
          <F label="Тип груза" value={form.cargo_type} onChange={v => set('cargo_type', v)} />
          <F label="Вес, кг" value={form.cargo_weight} onChange={v => set('cargo_weight', v)} keyboardType="numeric" />
          <F label="Паллеты" value={form.pallets} onChange={v => set('pallets', v)} keyboardType="numeric" />
          <F label="Объём, м³" value={form.volume} onChange={v => set('volume', v)} keyboardType="numeric" />
        </Sec>

        <Sec title="Финансы">
          <F label="Ставка клиента, BYN" value={form.rate_client} onChange={v => set('rate_client', v)} keyboardType="numeric" />
          <Pick options={PAY_STATUSES} value={form.payment_client_status} onChange={v => set('payment_client_status', v)} label="Статус оплаты" />
        </Sec>

        <Sec title="Документы">
          <Chk label="Документы высланы" value={form.documents_sent} onChange={v => set('documents_sent', v)} />
          <Chk label="Документы получены" value={form.documents_received} onChange={v => set('documents_received', v)} />
        </Sec>

        <Sec title="Примечания">
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
            value={form.notes}
            onChangeText={v => set('notes', v)}
            multiline
            placeholderTextColor={theme.colors.textTertiary}
          />
        </Sec>
      </ScrollView>
    </View>
  );
}

function Sec({ title, children }: any) {
  return <View style={styles.sec}><Text style={styles.secTitle}>{title}</Text>{children}</View>;
}
function F({ label, value, onChange, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={String(value ?? '')} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.colors.textTertiary} keyboardType={keyboardType || 'default'} />
    </View>
  );
}
function Pick({ label, options, value, onChange }: any) {
  return (
    <View style={styles.fieldRow}>
      {label && <Text style={styles.label}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {options.map((o: string) => (
            <TouchableOpacity key={o} style={[styles.chip, value === o && styles.chipActive]} onPress={() => onChange(o)}>
              <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
function Chk({ label, value, onChange }: any) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => onChange(!value)}>
      <View style={[styles.checkbox, value && styles.checkboxActive]}>
        {value && <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  saveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 60 },
  sec: { marginBottom: 22 },
  secTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  fieldRow: { marginBottom: 10 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: theme.colors.textPrimary },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.borderStrong, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkLabel: { fontSize: 14, color: theme.colors.textPrimary },
});
