import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';
import { CityInput } from '../../src/components/CityInput';

const PAY_STATUSES = ['не оплачен', 'частично', 'оплачен'];

export default function TruckOrderDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    Promise.all([
      api.truck.orders.get(id!),
      api.truck.clients.list(),
      api.truck.trucks.list(),
    ]).then(([order, cls, trs]: any) => {
      setForm(order || {});
      setClients(cls);
      setTrucks(trs);
    }).catch(() => Alert.alert('Ошибка')).finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const selectClient = (c: any) => { set('client_id', c.id); set('client_name', c.name); };
  const selectTruck = (t: any) => { set('truck_id', t.id); set('truck_name', t.name || ''); set('driver_name', t.driver_name || ''); };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      ['cargo_weight', 'pallets', 'volume', 'rate_client', 'carrier_payment_days'].forEach(k => {
        if (payload[k] !== '' && payload[k] != null) payload[k] = Number(payload[k]);
      });
      await api.truck.orders.update(id!, payload);
      Alert.alert('Сохранено');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  const remove = () => {
    Alert.alert('Удалить заявку?', form.order_number, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => { await api.truck.orders.remove(id!); router.back(); } },
    ]);
  };

  // Business days left for payment
  const daysLeft = (): number | null => {
    if (!form.payment_deadline || form.payment_status === 'оплачен') return null;
    const dl = new Date(form.payment_deadline);
    const now = new Date();
    if (dl <= now) return 0;
    let d = 0;
    const cur = new Date(now);
    while (cur < dl) { cur.setDate(cur.getDate() + 1); if (cur.getDay() !== 0 && cur.getDay() !== 6) d++; }
    return d;
  };
  const dl = daysLeft();

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.title}>{form.order_number || 'Заявка'}</Text>
          <Text style={styles.sub}>{form.client_name || ''}</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={remove} style={{ marginLeft: 8 }}><Trash2 size={18} color={theme.colors.loss} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Rate + deadline info */}
        <View style={styles.rateBlock}>
          <View>
            <Text style={styles.rateLabel}>СТАВКА КЛИЕНТА</Text>
            <Text style={styles.rateValue}>{formatMoney(form.rate_client ?? 0)}</Text>
          </View>
          {dl !== null && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rateLabel}>ДО ОПЛАТЫ</Text>
              <Text style={[styles.rateValue, { color: dl === 0 ? theme.colors.loss : dl <= 3 ? theme.colors.warning : theme.colors.info }]}>
                {dl === 0 ? 'просрочено' : `${dl} раб. дн.`}
              </Text>
            </View>
          )}
        </View>

        <S title="Клиент">
          {clients.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
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
        </S>

        <S title="Машина">
          {trucks.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {trucks.map(t => (
                  <TouchableOpacity key={t.id} style={[styles.chip, form.truck_id === t.id && styles.chipActive]} onPress={() => selectTruck(t)}>
                    <Text style={[styles.chipText, form.truck_id === t.id && styles.chipTextActive]}>{t.name} · {t.plate}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          <F label="Водитель" value={form.driver_name} onChange={v => set('driver_name', v)} />
        </S>

        <S title="Маршрут">
          <CityInput label="Город погрузки" value={form.city_loading ?? ''} onChangeText={v => set('city_loading', v)} placeholder="Минск" />
          <CityInput label="Город выгрузки" value={form.city_unloading ?? ''} onChangeText={v => set('city_unloading', v)} placeholder="Москва" />
          <F label="Дата погрузки" value={form.date_loading} onChange={v => set('date_loading', v)} />
          <F label="Дата выгрузки" value={form.date_unloading} onChange={v => set('date_unloading', v)} />
        </S>

        <S title="Груз">
          <F label="Тип груза" value={form.cargo_type} onChange={v => set('cargo_type', v)} />
          <F label="Вес, кг" value={form.cargo_weight} onChange={v => set('cargo_weight', v)} keyboardType="numeric" />
          <F label="Паллеты" value={form.pallets} onChange={v => set('pallets', v)} keyboardType="numeric" />
          <F label="Объём, м³" value={form.volume} onChange={v => set('volume', v)} keyboardType="numeric" />
        </S>

        <S title="Финансы и оплата">
          <F label="Ставка клиента, BYN" value={form.rate_client} onChange={v => set('rate_client', v)} keyboardType="numeric" />
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Статус оплаты</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PAY_STATUSES.map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, form.payment_status === s && styles.chipActive]} onPress={() => set('payment_status', s)}>
                    <Text style={[styles.chipText, form.payment_status === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <F label="Банковских дней" value={form.carrier_payment_days} onChange={v => set('carrier_payment_days', v)} keyboardType="numeric" />
          {form.payment_deadline && (
            <Text style={styles.deadlineText}>
              Срок оплаты: {new Date(form.payment_deadline).toLocaleDateString('ru-RU')}
              {dl !== null ? ` (${dl === 0 ? 'просрочено' : `${dl} раб. дн.`})` : ''}
            </Text>
          )}
        </S>

        <S title="Документы">
          <Chk label="Документы высланы клиенту" value={form.documents_sent_client} onChange={v => set('documents_sent_client', v)} />
          <Chk label="Документы получены от клиента" value={form.documents_received_client} onChange={v => set('documents_received_client', v)} />
        </S>

        <S title="Примечания">
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.notes ?? ''} onChangeText={v => set('notes', v)} multiline placeholderTextColor={theme.colors.textTertiary} />
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
      <TextInput style={styles.input} value={value !== null && value !== undefined ? String(value) : ''} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.colors.textTertiary} keyboardType={keyboardType || 'default'} />
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 11, color: theme.colors.textTertiary },
  saveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 60 },
  rateBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
  rateLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  rateValue: { fontSize: 24, fontWeight: '700', color: theme.colors.accent, marginTop: 4 },
  sec: { marginBottom: 22 },
  secTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  fieldRow: { marginBottom: 10 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.borderStrong, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkLabel: { fontSize: 14, color: theme.colors.textPrimary },
  deadlineText: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
});
