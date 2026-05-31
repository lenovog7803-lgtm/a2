import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, Trash2, Plus, MapPin } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const STATUSES = ['новая', 'забрали', 'доставлено', 'отменён'];

export default function TruckTripDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [trip, setTrip] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, tr] = await Promise.all([
        api.truck.trips.get(id!) as Promise<any>,
        api.truck.trucks.list() as Promise<any>,
      ]);
      setTrip(t);
      setOrders(t.orders || []);
      setTrucks(tr);
    } catch { Alert.alert('Ошибка загрузки'); }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const set = (k: string, v: any) => setTrip((f: any) => ({ ...f, [k]: v }));

  const selectTruck = (t: any) => {
    set('truck_id', t.id); set('truck_name', t.name || '');
    set('driver_name', t.driver_name || ''); set('driver_phone', t.driver_phone || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...trip };
      delete payload.orders;
      payload.mileage = payload.mileage ? Number(payload.mileage) : 0;
      payload.fuel_liters_fact = payload.fuel_liters_fact ? Number(payload.fuel_liters_fact) : 0;
      const updated = await api.truck.trips.update(id!, payload) as any;
      setTrip({ ...updated, orders: updated.orders || orders });
      setOrders(updated.orders || orders);
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

  const deleteOrder = (orderId: string) => {
    Alert.alert('Удалить заявку?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.truck.orders.remove(orderId);
        const updated = await api.truck.trips.get(id!) as any;
        setTrip(updated);
        setOrders(updated.orders || []);
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={styles.title}>Рейс {trip.trip_number}</Text>
          <Text style={styles.sub}>{trip.truck_name || ''}{trip.driver_name ? ` · ${trip.driver_name}` : ''}</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={remove} style={{ marginLeft: 8 }}><Trash2 size={18} color={theme.colors.loss} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Totals block */}
        <View style={styles.totalsBlock}>
          <Row label="Общая ставка" value={formatMoney(trip.rate_total ?? 0)} />
          <Row label="Аренда инвестору" value={formatMoney(trip.rate_investor ?? 0)} />
          {(trip.bonus_amount ?? 0) > 0 && (
            <Row label="🎁 Бонус инвестору" value={`+${formatMoney(trip.bonus_amount)}`} accent />
          )}
          <Row label="Топливо план" value={`${trip.fuel_liters_plan ?? 0} л / ${formatMoney(trip.fuel_cost_plan ?? 0)}`} />
          {trip.fuel_liters_fact > 0 && (
            <Row label="Топливо факт" value={`${trip.fuel_liters_fact} л / ${formatMoney(trip.fuel_cost_fact ?? 0)}`} />
          )}
        </View>

        <S title="Машина">
          {trucks.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
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
        </S>

        <S title="Даты и пробег">
          <F label="Дата погрузки" value={trip.date_loading} onChange={v => set('date_loading', v)} />
          <F label="Дата разгрузки" value={trip.date_unloading} onChange={v => set('date_unloading', v)} />
          <F label="Пробег, км" value={trip.mileage} onChange={v => set('mileage', v)} keyboardType="numeric" />
          <F label="Топливо факт, л" value={trip.fuel_liters_fact} onChange={v => set('fuel_liters_fact', v)} keyboardType="numeric" />
        </S>

        <S title="Статус">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {STATUSES.map(s => (
                <TouchableOpacity key={s} style={[styles.chip, trip.status === s && styles.chipActive]} onPress={() => set('status', s)}>
                  <Text style={[styles.chipText, trip.status === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </S>

        {/* Orders */}
        <S title={`Заявки (${orders.length})`}>
          {orders.map(o => (
            <TouchableOpacity key={o.id} style={styles.orderCard} onPress={() => router.push(`/truck-order/${o.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNum}>{o.order_number}</Text>
                <Text style={styles.orderClient}>{o.client_name || '—'}</Text>
                {(o.city_loading || o.city_unloading) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MapPin size={11} color={theme.colors.accent} />
                    <Text style={styles.orderRoute}>{[o.city_loading, o.city_unloading].filter(Boolean).join(' → ')}</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.orderRate}>{formatMoney(o.rate_client)}</Text>
                <Text style={[styles.orderPay, { color: o.payment_status === 'оплачен' ? theme.colors.profit : o.payment_status === 'частично' ? theme.colors.warning : theme.colors.textTertiary }]}>
                  {o.payment_status}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteOrder(o.id)} style={{ marginLeft: 10, padding: 4 }}>
                <Trash2 size={14} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          {/* Summary */}
          {orders.length > 0 && (
            <View style={styles.ordersSummary}>
              <Text style={styles.summaryText}>Общая ставка: {formatMoney(trip.rate_total ?? 0)}</Text>
              <Text style={styles.summaryText}>Аренда инвестору: {formatMoney(trip.rate_investor ?? 0)}</Text>
              {(trip.bonus_amount ?? 0) > 0 && (
                <Text style={[styles.summaryText, { color: theme.colors.accentBright }]}>🎁 Бонус инвестору: +{formatMoney(trip.bonus_amount)}</Text>
              )}
            </View>
          )}
          <TouchableOpacity style={styles.addOrderBtn} onPress={() => router.push(`/truck-order/new?trip_id=${id}`)}>
            <Plus size={16} color={theme.colors.accent} />
            <Text style={styles.addOrderText}>Добавить заявку</Text>
          </TouchableOpacity>
        </S>

        <S title="Примечания">
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={trip.notes ?? ''} onChangeText={v => set('notes', v)} multiline placeholderTextColor={theme.colors.textTertiary} />
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
function Row({ label, value, accent }: any) {
  return (
    <View style={styles.calcRow}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={[styles.calcValue, accent && { color: theme.colors.accentBright }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 11, color: theme.colors.textTertiary },
  saveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 60 },
  totalsBlock: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  calcLabel: { fontSize: 13, color: theme.colors.textSecondary },
  calcValue: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  sec: { marginBottom: 22 },
  secTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  fieldRow: { marginBottom: 10 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  orderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  orderNum: { fontSize: 13, fontWeight: '700', color: theme.colors.accent, letterSpacing: 0.5 },
  orderClient: { fontSize: 13, color: theme.colors.textPrimary, marginTop: 1 },
  orderRoute: { fontSize: 11, color: theme.colors.textSecondary },
  orderRate: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  orderPay: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  ordersSummary: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, padding: 10, marginBottom: 10 },
  summaryText: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 2 },
  addOrderBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.accent + '50', borderStyle: 'dashed' },
  addOrderText: { fontSize: 14, color: theme.colors.accent, fontWeight: '600' },
});
