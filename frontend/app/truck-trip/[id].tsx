import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, Trash2, Plus, MapPin } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const STATUSES = ['новая', 'забрали', 'доставлено', 'отменён'];
const PAY_INV = ['не выплачено', 'выплачено'];

export default function TruckTripDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [trip, setTrip] = useState<any>({});
  const [routes, setRoutes] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, tr] = await Promise.all([
        api.truck.trips.get(id!) as Promise<any>,
        api.truck.trucks.list() as Promise<any>,
      ]);
      setTrip(t);
      setRoutes(t.routes || []);
      setTrucks(tr);
    } catch { Alert.alert('Ошибка загрузки'); }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const set = (k: string, v: any) => setTrip((f: any) => ({ ...f, [k]: v }));

  const selectTruck = (t: any) => {
    set('truck_id', t.id);
    set('truck_name', t.name || '');
    set('driver_name', t.driver_name || '');
    set('driver_phone', t.driver_phone || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...trip };
      delete payload.routes;
      ['mileage', 'fuel_liters_fact', 'carrier_payment_days'].forEach(k => {
        if (payload[k] !== '' && payload[k] != null) payload[k] = Number(payload[k]);
      });
      const updated = await api.truck.trips.update(id!, payload) as any;
      setTrip({ ...updated, routes: updated.routes || routes });
      setRoutes(updated.routes || routes);
      Alert.alert('Сохранено');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  const remove = () => {
    Alert.alert('Удалить рейс?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => { await api.truck.trips.remove(id!); router.back(); } },
    ]);
  };

  const deleteRoute = (routeId: string) => {
    Alert.alert('Удалить маршрут?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.truck.routes.remove(routeId);
        setRoutes(r => r.filter(x => x.id !== routeId));
        // refresh totals
        const updated = await api.truck.trips.get(id!) as any;
        setTrip((t: any) => ({ ...t, ...updated, routes: updated.routes || [] }));
      }},
    ]);
  };

  const investorDeadline = trip.investor_payment_deadline
    ? new Date(trip.investor_payment_deadline).toLocaleDateString('ru-RU') : null;
  const daysLeft = (): number | null => {
    if (!trip.investor_payment_deadline) return null;
    const dl = new Date(trip.investor_payment_deadline);
    const now = new Date();
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
          <Text style={styles.title}>{trip.trip_number || 'Рейс'}</Text>
          <Text style={styles.sub}>{trip.truck_name || ''} · {trip.driver_name || ''}</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={remove} style={{ marginLeft: 8 }}><Trash2 size={18} color={theme.colors.loss} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Авторасчёт */}
        <View style={styles.calcBlock}>
          <CalcRow label="Ставка итого (маршруты)" value={formatMoney(trip.rate_total ?? 0)} />
          <CalcRow label="Аренда инвестору" value={formatMoney(trip.rate_investor ?? 0)} />
          {(trip.bonus_amount ?? 0) > 0 && (
            <CalcRow label="🎁 Бонус инвестору" value={`+${formatMoney(trip.bonus_amount)}`} accent />
          )}
          <CalcRow label="Топливо план" value={`${trip.fuel_liters_plan ?? 0} л / ${formatMoney(trip.fuel_cost_plan ?? 0)}`} />
          {investorDeadline && (
            <CalcRow
              label="Срок выплаты инвестору"
              value={`${investorDeadline}${dl !== null ? ` (${dl} раб. дн.)` : ''}`}
              warn={dl !== null && dl < 5}
            />
          )}
        </View>

        <Sec title="Машина">
          {trucks.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {trucks.map(t => (
                  <TouchableOpacity key={t.id} style={[styles.chip, trip.truck_id === t.id && styles.chipActive]} onPress={() => selectTruck(t)}>
                    <Text style={[styles.chipText, trip.truck_id === t.id && styles.chipTextActive]}>{t.name} · {t.plate}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          <F label="Водитель" value={trip.driver_name} onChange={v => set('driver_name', v)} />
          <F label="Телефон водителя" value={trip.driver_phone} onChange={v => set('driver_phone', v)} keyboardType="phone-pad" />
        </Sec>

        <Sec title="Даты и пробег">
          <F label="Дата загрузки" value={trip.date_loading} onChange={v => set('date_loading', v)} />
          <F label="Дата выгрузки" value={trip.date_unloading} onChange={v => set('date_unloading', v)} />
          <F label="Пробег, км" value={trip.mileage} onChange={v => set('mileage', v)} keyboardType="numeric" />
          <F label="Топливо факт, л" value={trip.fuel_liters_fact} onChange={v => set('fuel_liters_fact', v)} keyboardType="numeric" />
        </Sec>

        {/* Маршруты */}
        <Sec title={`Маршруты (${routes.length})`}>
          {routes.map(r => (
            <TouchableOpacity key={r.id} style={styles.routeCard} onPress={() => router.push(`/truck-route/${r.id}`)}>
              <MapPin size={14} color={theme.colors.accent} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.routeName}>{r.route || r.client_name || '—'}</Text>
                <Text style={styles.routeMeta}>{r.client_name}{r.cargo_type ? ` · ${r.cargo_type}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.routeRate}>{formatMoney(r.rate_client)}</Text>
                <Text style={[styles.routePay, { color: r.payment_client_status === 'оплачен' ? theme.colors.profit : theme.colors.textTertiary }]}>
                  {r.payment_client_status || '—'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteRoute(r.id)} style={{ marginLeft: 10 }}>
                <Trash2 size={14} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addRouteBtn} onPress={() => router.push(`/truck-route/new?trip_id=${id}`)}>
            <Plus size={16} color={theme.colors.accent} />
            <Text style={styles.addRouteBtnText}>Добавить маршрут</Text>
          </TouchableOpacity>
        </Sec>

        <Sec title="Статус">
          <Pick options={STATUSES} value={trip.status} onChange={v => set('status', v)} />
        </Sec>

        <Sec title="Документы">
          <Chk label="Документы высланы клиентам" value={trip.documents_sent_client} onChange={v => set('documents_sent_client', v)} />
          <Chk label="Документы получены от клиента" value={trip.documents_received_client} onChange={v => set('documents_received_client', v)} />
          <F label="Банковских дней на выплату" value={trip.carrier_payment_days} onChange={v => set('carrier_payment_days', v)} keyboardType="numeric" />
        </Sec>

        <Sec title="Оплата инвестору">
          <Pick options={PAY_INV} value={trip.payment_investor_status} onChange={v => set('payment_investor_status', v)} />
          {trip.payment_investor_status === 'выплачено' && (
            <F label="Дата выплаты" value={trip.payment_investor_date} onChange={v => set('payment_investor_date', v)} placeholder="2026-06-15" />
          )}
        </Sec>

        <Sec title="Примечания">
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={trip.notes ?? ''}
            onChangeText={v => set('notes', v)}
            multiline
            placeholderTextColor={theme.colors.textTertiary}
          />
        </Sec>
      </ScrollView>
    </View>
  );
}

function CalcRow({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <View style={styles.calcRow}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={[styles.calcValue, accent && { color: theme.colors.accentBright }, warn && { color: theme.colors.loss }]}>{value}</Text>
    </View>
  );
}

function Sec({ title, children }: any) {
  return <View style={styles.sec}><Text style={styles.secTitle}>{title}</Text>{children}</View>;
}

function F({ label, value, onChange, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value !== null && value !== undefined ? String(value) : ''} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.colors.textTertiary} keyboardType={keyboardType || 'default'} />
    </View>
  );
}

function Pick({ options, value, onChange }: any) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map((o: string) => (
          <TouchableOpacity key={o} style={[styles.chip, value === o && styles.chipActive]} onPress={() => onChange(o)}>
            <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
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
  calcBlock: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  calcLabel: { fontSize: 13, color: theme.colors.textSecondary },
  calcValue: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  sec: { marginBottom: 22 },
  secTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  fieldRow: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: theme.colors.textPrimary },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.borderStrong, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkLabel: { fontSize: 14, color: theme.colors.textPrimary },
  routeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  routeName: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  routeMeta: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  routeRate: { fontSize: 14, fontWeight: '700', color: theme.colors.accent },
  routePay: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  addRouteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.accent + '50', borderStyle: 'dashed' },
  addRouteBtnText: { fontSize: 14, color: theme.colors.accent, fontWeight: '600' },
});
