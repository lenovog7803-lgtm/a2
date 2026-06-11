import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Linking, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Trash2, Edit3, Phone, Star, Truck as TruckIcon, Copy, ChevronDown, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';

const BASIS_OPTIONS = [
  { id: 'устава', label: 'Устава' },
  { id: 'свидетельства', label: 'Свидетельства' },
];

const VEHICLES = ['Тент', 'Реф', 'Изотерм', 'Бортовой', 'Контейнер'];

export default function CarrierDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [carrier, setCarrier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [basisOpen, setBasisOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [acts, setActs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [c, allOrders] = await Promise.all([api.carriers.get(id!), api.orders.list()]);
        setCarrier(c);
        setOrders(allOrders.filter((o: any) => o.carrier_name === c.company_name));
      } catch (e: any) {
        Alert.alert('Ошибка', e.message);
        router.back();
      } finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => {
    if (id) {
      api.reconciliation.history({ counterparty_id: id, type: 'carrier' })
        .then((data: any[]) => setActs(data || []))
        .catch(() => {});
    }
  }, [id]);

  const update = (patch: any) => setCarrier((prev: any) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const { id: _id, created_at, ...payload } = carrier;
      await api.carriers.update(carrier.id, payload);
      setEditing(false);
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setSaving(false); }
  };

  const remove = () => {
    Alert.alert('Удалить перевозчика?', carrier.company_name, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => { await api.carriers.delete(carrier.id); router.back(); } },
    ]);
  };

  const copyText = async (text: string, label: string) => {
    if (!text) return;
    try { await Clipboard.setStringAsync(text); Alert.alert('Скопировано', `${label}: ${text}`); } catch { Alert.alert(label, text); }
  };

  if (loading || !carrier) {
    return <View style={[styles.center, { backgroundColor: theme.colors.bg }]}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{editing ? 'Редактирование' : 'Перевозчик'}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn} testID="edit-carrier-btn">
              <Edit3 size={18} color={theme.colors.accent} strokeWidth={1.6} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={remove} style={styles.iconBtn}>
            <Trash2 size={18} color={theme.colors.loss} strokeWidth={1.6} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}>
        {!editing ? (
          <>
            <View style={styles.headerCard}>
              <View style={styles.avatar}><TruckIcon size={28} color={theme.colors.accent} strokeWidth={1.5} /></View>
              <Text style={styles.name}>{carrier.company_name}</Text>
              {!!carrier.driver_name && <Text style={styles.contact}>{carrier.driver_name}</Text>}
              <View style={styles.ratingBox}>
                <Star size={14} color={theme.colors.accent} fill={theme.colors.accent} />
                <Text style={styles.rating}>{(carrier.rating || 0).toFixed(1)}</Text>
              </View>
              {!!carrier.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${carrier.phone}`)} activeOpacity={0.7}>
                  <Phone size={14} color="#000" strokeWidth={2} />
                  <Text style={styles.callText}>{carrier.phone}</Text>
                </TouchableOpacity>
              )}
              {!!carrier.email && (
                <TouchableOpacity style={[styles.callBtn, { backgroundColor: theme.colors.surfaceElevated, marginTop: 6 }]} onPress={() => Linking.openURL(`mailto:${carrier.email}`)} activeOpacity={0.7}>
                  <Text style={[styles.callText, { color: theme.colors.textPrimary }]}>{carrier.email}</Text>
                </TouchableOpacity>
              )}
            </View>

            {(carrier.vehicle_type || carrier.plate) && (
              <Section title="ТРАНСПОРТ">
                <Row label="Тип" value={carrier.vehicle_type} />
                <Row label="Гос. номер" value={carrier.plate} mono onCopy={() => copyText(carrier.plate, 'Гос. номер')} />
                <Row label="Грузоподъёмность" value={carrier.capacity_tons ? `${carrier.capacity_tons} т` : ''} />
                <Row label="Объём" value={carrier.capacity_m3 ? `${carrier.capacity_m3} м³` : ''} />
              </Section>
            )}

            {(carrier.inn || carrier.kpp || carrier.legal_address || carrier.postal_address || carrier.director || carrier.basis) && (
              <Section title="РЕКВИЗИТЫ">
                <Row label="УНП" value={carrier.unp || carrier.inn} onCopy={() => copyText(carrier.unp || carrier.inn, 'УНП')} />
                
                <Row label="Адрес" value={carrier.address || carrier.legal_address} multiline onCopy={() => copyText(carrier.address || carrier.legal_address, 'Адрес')} />
                <Row label="Почтовый адрес" value={carrier.postal_address} multiline onCopy={() => copyText(carrier.postal_address, 'Почтовый адрес')} />
                <Row label="Директор" value={carrier.director} onCopy={() => copyText(carrier.director, 'Директор')} />
                <Row label="Основание" value={carrier.basis ? BASIS_OPTIONS.find(o => o.id === carrier.basis)?.label || carrier.basis : ''} />
              </Section>
            )}

            {(carrier.bank_name || carrier.bank_account) && (
              <Section title="БАНКОВСКИЕ РЕКВИЗИТЫ">
                <Row label="Банк" value={carrier.bank || carrier.bank_name} onCopy={() => copyText(carrier.bank || carrier.bank_name, 'Банк')} />
                <Row label="Расчётный счёт" value={carrier.rs || carrier.bank_account} mono onCopy={() => copyText(carrier.rs || carrier.bank_account, 'Р/с')} />
                <Row label="БИК" value={carrier.bik || carrier.bank_bik} mono onCopy={() => copyText(carrier.bik || carrier.bank_bik, 'БИК')} />
                
              </Section>
            )}

            {(carrier.cargo_types || carrier.regions || carrier.notes) && (
              <Section title="ДОПОЛНИТЕЛЬНО">
                <Row label="Что возят" value={carrier.cargo_types} multiline />
                <Row label="Регионы" value={carrier.regions} multiline />
                <Row label="Заметки" value={carrier.notes} multiline />
              </Section>
            )}

            {/* История заявок */}
            <OrdersHistory
              orders={orders}
              rateKey="carrier_rate"
              onPress={(oid: string) => router.push('/order/' + oid)}
            />

            {/* Акты сверки */}
            {acts.length > 0 && (
              <View style={{ marginTop: 4, marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>АКТЫ СВЕРКИ</Text>
                <View style={styles.section}>
                  {acts.map((act: any, i: number) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => Platform.OS === 'web' ? window.open(act.doc_url, '_blank') : Linking.openURL(act.doc_url)}
                      style={[styles.orderRow, i === acts.length - 1 && { borderBottomWidth: 0 }]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: theme.colors.textPrimary, flex: 1, fontSize: 13 }}>{act.period_label}</Text>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginRight: 10 }}>{act.created_at}</Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>Открыть →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            <Field label="Компания / ИП" value={carrier.company_name} onChangeText={(v: string) => update({ company_name: v })} />
            <Field label="Водитель / контакт" value={carrier.driver_name} onChangeText={(v: string) => update({ driver_name: v })} />
            <Field label="Телефон" keyboardType="phone-pad" value={carrier.phone} onChangeText={(v: string) => update({ phone: v })} />
            <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={carrier.email || ''} onChangeText={(v: string) => update({ email: v })} />

            <Text style={styles.groupLabel}>ТРАНСПОРТ</Text>
            <Text style={styles.miniLabel}>ТИП ТС</Text>
            <View style={styles.choiceRow}>
              {VEHICLES.map(v => (
                <TouchableOpacity key={v} onPress={() => update({ vehicle_type: v })} style={[styles.pill, carrier.vehicle_type === v && styles.pillActive]} activeOpacity={0.7}>
                  <Text style={[styles.pillText, carrier.vehicle_type === v && styles.pillTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}><Field label="Тонн" keyboardType="numeric" value={String(carrier.capacity_tons || '')} onChangeText={(v: string) => update({ capacity_tons: parseFloat(v) || 0 })} /></View>
              <View style={{ flex: 1 }}><Field label="Объём, м³" keyboardType="numeric" value={String(carrier.capacity_m3 || '')} onChangeText={(v: string) => update({ capacity_m3: parseFloat(v) || 0 })} /></View>
            </View>
            <Field label="Гос. номер" autoCapitalize="characters" value={carrier.plate} onChangeText={(v: string) => update({ plate: v })} />
            <Field label="Рейтинг (0-5)" keyboardType="numeric" value={String(carrier.rating || '')} onChangeText={(v: string) => update({ rating: parseFloat(v) || 0 })} />

            <Text style={styles.groupLabel}>РЕКВИЗИТЫ</Text>
            <Field label="ИНН" keyboardType="numeric" value={carrier.inn} onChangeText={(v: string) => update({ inn: v })} />
            <Field label="КПП" keyboardType="numeric" value={carrier.kpp} onChangeText={(v: string) => update({ kpp: v })} />
            <Field label="Юр. адрес" multiline value={carrier.legal_address} onChangeText={(v: string) => update({ legal_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
            <Field label="Почтовый адрес" multiline value={carrier.postal_address || ''} onChangeText={(v: string) => update({ postal_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
            <Field label="Директор" value={carrier.director || ''} onChangeText={(v: string) => update({ director: v })} />

            <Text style={styles.fieldLabel}>ОСНОВАНИЕ</Text>
            <TouchableOpacity onPress={() => setBasisOpen(true)} activeOpacity={0.7} style={styles.dropdownBtn}>
              <Text style={[styles.dropdownValue, !carrier.basis && { color: theme.colors.textTertiary }]}>
                {BASIS_OPTIONS.find(o => o.id === carrier.basis)?.label || 'Выбрать…'}
              </Text>
              <ChevronDown size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
            </TouchableOpacity>

            <Modal visible={basisOpen} transparent animationType="fade" onRequestClose={() => setBasisOpen(false)}>
              <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setBasisOpen(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
                  <View style={styles.sheetHead}>
                    <Text style={styles.sheetTitle}>Основание</Text>
                    <TouchableOpacity onPress={() => setBasisOpen(false)}>
                      <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={BASIS_OPTIONS}
                    keyExtractor={(i) => i.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const active = item.id === carrier.basis;
                      return (
                        <TouchableOpacity
                          style={[styles.sheetItem, active && styles.sheetItemActive]}
                          onPress={() => { update({ basis: item.id }); setBasisOpen(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.sheetItemLabel, active && { color: theme.colors.accent }]}>{item.label}</Text>
                          {active && <Check size={16} color={theme.colors.accent} strokeWidth={2} />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

            <Text style={styles.groupLabel}>БАНК</Text>
            <Field label="Банк" value={carrier.bank_name} onChangeText={(v: string) => update({ bank_name: v })} />
            <Field label="Расчётный счёт" keyboardType="numeric" value={carrier.bank_account} onChangeText={(v: string) => update({ bank_account: v })} />
            <Field label="БИК" keyboardType="numeric" value={carrier.bank_bik} onChangeText={(v: string) => update({ bank_bik: v })} />
            <Field label="Корр. счёт" keyboardType="numeric" value={carrier.bank_corr_account} onChangeText={(v: string) => update({ bank_corr_account: v })} />

            <Text style={styles.groupLabel}>ДОП ИНФО</Text>
            <Field label="Что возят" multiline value={carrier.cargo_types} onChangeText={(v: string) => update({ cargo_types: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
            <Field label="Регионы работы" multiline value={carrier.regions} onChangeText={(v: string) => update({ regions: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
            <Field label="Заметки" multiline value={carrier.notes} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn} activeOpacity={0.7}><Text style={styles.cancelText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8} testID="save-carrier-btn">
                {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая', in_progress: 'В пути', done: 'Завершена', cancelled: 'Отменена',
};
function statusColor(s: string) {
  if (s === 'done') return theme.colors.profit;
  if (s === 'cancelled') return theme.colors.loss;
  if (s === 'in_progress') return theme.colors.accent;
  return theme.colors.textTertiary;
}

function OrdersHistory({ orders, rateKey, onPress }: { orders: any[]; rateKey: string; onPress: (id: string) => void }) {
  const total = orders.reduce((s: number, o: any) => s + (o[rateKey] || 0), 0);
  const count = orders.length;
  const word = count === 1 ? 'заявка' : count < 5 ? 'заявки' : 'заявок';
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.sectionTitle}>ИСТОРИЯ ЗАЯВОК</Text>
      <View style={styles.section}>
        {count === 0 ? (
          <Text style={styles.emptyOrders}>Нет заявок</Text>
        ) : (
          orders.map((o, i) => (
            <TouchableOpacity
              key={o.id}
              onPress={() => onPress(o.id)}
              style={[styles.orderRow, i === count - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNum}>№{o.order_number}</Text>
                <Text style={styles.orderRoute} numberOfLines={1}>{o.route_from} → {o.route_to}</Text>
                {!!o.load_date && <Text style={styles.orderDate}>{o.load_date}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.orderRate}>{o[rateKey] ? `${Number(o[rateKey]).toLocaleString()} ₽` : '—'}</Text>
                <Text style={[styles.orderStatus, { color: statusColor(o.status) }]}>{STATUS_LABELS[o.status] || o.status}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        {count > 0 && (
          <View style={styles.orderTotals}>
            <Text style={styles.orderTotalsLabel}>Итого {count} {word}</Text>
            <Text style={styles.orderTotalsValue}>{Number(total).toLocaleString()} ₽</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.section}>{children}</View>
    </View>
  );
}

function Row({ label, value, mono, multiline, onCopy }: any) {
  if (!value && value !== 0) return null;
  if (value === '' || value === '0') return null;
  return (
    <View style={[styles.row, multiline && { alignItems: 'flex-start' }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <Text style={[styles.rowValue, mono && { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), letterSpacing: 0.3 }]} numberOfLines={multiline ? 5 : 1}>
          {value}
        </Text>
        {onCopy && (
          <TouchableOpacity onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Copy size={14} color={theme.colors.textTertiary} strokeWidth={1.6} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
  headerCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 14, backgroundColor: theme.colors.accent + '15', borderWidth: 1, borderColor: theme.colors.accent + '40', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  contact: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  rating: { color: theme.colors.accent, fontSize: 14, fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.colors.accent, borderRadius: 8 },
  callText: { color: '#000', fontSize: 13, fontWeight: '700' },

  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 8, marginLeft: 4 },
  section: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: '600', minWidth: 110 },
  rowValue: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '500', textAlign: 'right', flexShrink: 1 },

  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.accent, marginTop: 16, marginBottom: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 6, marginTop: 4 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  dropdownValue: { color: theme.colors.textPrimary, fontSize: 15, flex: 1, marginRight: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetItemActive: { backgroundColor: theme.colors.accent + '10' },
  sheetItemLabel: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '500', flex: 1 },
  miniLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: theme.colors.textTertiary, marginBottom: 6 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  pillActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  pillText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: theme.colors.accent },
  saveBtn: { flex: 1, backgroundColor: theme.colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#000', fontSize: 14, fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: theme.colors.surfaceElevated, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  cancelText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' },

  emptyOrders: { color: theme.colors.textTertiary, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  orderNum: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' },
  orderRoute: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  orderDate: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  orderRate: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' },
  orderStatus: { fontSize: 11, fontWeight: '600' },
  orderTotals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  orderTotalsLabel: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: '600' },
  orderTotalsValue: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
});
