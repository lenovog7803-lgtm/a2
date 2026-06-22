import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Linking, TextInput, Modal, FlatList, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Trash2, Edit3, Phone, Star, Copy, ChevronDown, Check, Truck as TruckIcon, Building2, FileText, Landmark, Info } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { MiniChart } from '../../src/components/MiniChart';

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const BASIS_OPTIONS = [{ id: 'устава', label: 'Устава' }, { id: 'свидетельства', label: 'Свидетельства' }];
const VEHICLES = ['Тент', 'Реф', 'Изотерм', 'Бортовой', 'Контейнер'];

// ── Form helpers ────────────────────────────────────────────────────────────
function FormSection({ title, icon, children }: any) {
  const icons: Record<string, any> = { building: Building2, file: FileText, bank: Landmark, info: Info, truck: TruckIcon };
  const Icon = icons[icon] || Info;
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: theme.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
        <Icon size={14} color={theme.colors.accent} strokeWidth={2} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>{children}</View>
    </View>
  );
}

function FormRow({ children }: any) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{children}</View>;
}

function FormField({ label, value, onChange, placeholder, keyboardType, multiline, mono, flex }: any) {
  return (
    <View style={{ flex: flex || 1 }}>
      {!!label && <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{label}</Text>}
      <TextInput
        value={value || ''} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary} keyboardType={keyboardType}
        multiline={multiline}
        style={{ backgroundColor: theme.colors.bg, borderRadius: 10, borderWidth: 0.5, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: mono ? 12 : 14, color: theme.colors.textPrimary, fontFamily: mono ? Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) : undefined, minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : 'center' }}
      />
    </View>
  );
}
// ── End form helpers ─────────────────────────────────────────────────────────

export default function CarrierDetail() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
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
    try { await Clipboard.setStringAsync(text); Alert.alert('Скопировано', `${label}: ${text}`); }
    catch { Alert.alert(label, text); }
  };

  if (loading || !carrier) {
    return <View style={[styles.center, { backgroundColor: theme.colors.bg }]}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 8, paddingBottom: 14, backgroundColor: theme.colors.surface, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.colors.border }}>
          <ArrowLeft size={16} color={theme.colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary }} numberOfLines={1}>
            {editing ? 'Редактирование' : carrier.company_name}
          </Text>
          {editing && <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 }}>Редактирование перевозчика</Text>}
        </View>
        {!editing ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setEditing(true)} testID="edit-carrier-btn" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.accent + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Edit3 size={15} color={theme.colors.accent} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity onPress={remove} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={15} color="#EF4444" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(false)} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.colors.border }}>
            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 100 }}>
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
                  <Phone size={14} color="#fff" strokeWidth={2} />
                  <Text style={styles.callText}>{carrier.phone}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Trips MiniChart */}
            {orders.length > 1 && (() => {
              const last6 = Array.from({ length: 6 }, (_, i) => {
                const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              });
              const tripsData = last6.map(ym =>
                orders.filter((o: any) => (o.unload_date || o.load_date || '').startsWith(ym)).length
              );
              if (tripsData.every((v: number) => v === 0)) return null;
              const mLabels = last6.map(ym => MONTHS_SHORT[parseInt(ym.slice(5), 10) - 1]);
              const chartW = screenW - 40 - 36;
              return (
                <View style={[styles.section, { marginBottom: 0, padding: 14 }]}>
                  <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>РЕЙСЫ ПО МЕСЯЦАМ</Text>
                  <MiniChart data={tripsData} width={chartW} height={80} color="#7C3AED" showTooltip labels={mLabels} />
                </View>
              );
            })()}

            {(carrier.capacity_tons || carrier.capacity_m3) && (
              <Section title="ТРАНСПОРТ">
                <Row label="Грузоподъёмность" value={carrier.capacity_tons ? `${carrier.capacity_tons} т` : ''} />
                <Row label="Объём" value={carrier.capacity_m3 ? `${carrier.capacity_m3} м³` : ''} />
              </Section>
            )}

            {(carrier.unp || carrier.inn || carrier.address || carrier.legal_address || carrier.director || carrier.basis) && (
              <Section title="РЕКВИЗИТЫ">
                <Row label="УНП" value={carrier.unp || carrier.inn || ''} onCopy={() => copyText(carrier.unp || carrier.inn || '', 'УНП')} />
                <Row label="Адрес" value={carrier.address || carrier.legal_address || ''} multiline onCopy={() => copyText(carrier.address || carrier.legal_address || '', 'Адрес')} />
                <Row label="Почтовый адрес" value={carrier.postal_address || ''} multiline onCopy={() => copyText(carrier.postal_address || '', 'Почтовый адрес')} />
                <Row label="Директор" value={carrier.director || ''} onCopy={() => copyText(carrier.director || '', 'Директор')} />
                <Row label="Основание" value={carrier.basis ? BASIS_OPTIONS.find(o => o.id === carrier.basis)?.label || carrier.basis : ''} />
              </Section>
            )}

            {(carrier.bank || carrier.bank_name || carrier.rs || carrier.bank_account || carrier.bik || carrier.bank_bik) && (
              <Section title="БАНКОВСКИЕ РЕКВИЗИТЫ">
                <Row label="Банк" value={carrier.bank || carrier.bank_name || ''} onCopy={() => copyText(carrier.bank || carrier.bank_name || '', 'Банк')} />
                <Row label="Расчётный счёт" value={carrier.rs || carrier.bank_account || ''} mono onCopy={() => copyText(carrier.rs || carrier.bank_account || '', 'Р/с')} />
                <Row label="БИК" value={carrier.bik || carrier.bank_bik || ''} mono onCopy={() => copyText(carrier.bik || carrier.bank_bik || '', 'БИК')} />
              </Section>
            )}

            {(carrier.cargo_types || carrier.regions || carrier.notes) && (
              <Section title="ДОПОЛНИТЕЛЬНО">
                <Row label="Что возят" value={carrier.cargo_types} multiline />
                <Row label="Регионы" value={carrier.regions} multiline />
                <Row label="Заметки" value={carrier.notes} multiline />
              </Section>
            )}

            <OrdersHistory orders={orders} rateKey="carrier_rate" onPress={(oid: string) => router.push('/order/' + oid)} />

            {acts.length > 0 && (
              <View style={{ marginBottom: 0 }}>
                <Text style={styles.sectionTitle}>АКТЫ СВЕРКИ</Text>
                <View style={styles.section}>
                  {acts.map((act: any, i: number) => (
                    <TouchableOpacity key={i}
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
            <FormSection title="Основная информация" icon="building">
              <FormField label="Компания / ИП" value={carrier.company_name} onChange={(v: string) => update({ company_name: v })} placeholder="ООО 'Транспорт'" />
              <FormRow>
                <FormField label="Водитель / контакт" value={carrier.driver_name} onChange={(v: string) => update({ driver_name: v })} placeholder="Иванов Иван" />
                <FormField label="Телефон" value={carrier.phone} onChange={(v: string) => update({ phone: v })} placeholder="+375 (29) 000-00-00" keyboardType="phone-pad" />
              </FormRow>
              <FormField label="Email" value={carrier.email || ''} onChange={(v: string) => update({ email: v })} placeholder="carrier@example.com" keyboardType="email-address" />
            </FormSection>

            <FormSection title="Транспорт" icon="truck">
              <View>
                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Тип ТС</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {VEHICLES.map(v => (
                    <TouchableOpacity key={v} onPress={() => update({ vehicle_type: v })}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: carrier.vehicle_type === v ? theme.colors.accent + '20' : theme.colors.bg, borderRadius: 8, borderWidth: 0.5, borderColor: carrier.vehicle_type === v ? theme.colors.accent : theme.colors.border }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: carrier.vehicle_type === v ? theme.colors.accent : theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <FormRow>
                <FormField label="Тонн" value={String(carrier.capacity_tons || '')} onChange={(v: string) => update({ capacity_tons: parseFloat(v) || 0 })} keyboardType="numeric" placeholder="20" />
                <FormField label="Объём, м³" value={String(carrier.capacity_m3 || '')} onChange={(v: string) => update({ capacity_m3: parseFloat(v) || 0 })} keyboardType="numeric" placeholder="82" />
              </FormRow>
              <FormRow>
                <FormField label="Гос. номер" value={carrier.plate} onChange={(v: string) => update({ plate: v })} placeholder="АА 0000-7" />
                <FormField label="Рейтинг (0-5)" value={String(carrier.rating || '')} onChange={(v: string) => update({ rating: parseFloat(v) || 0 })} keyboardType="numeric" placeholder="5.0" />
              </FormRow>
            </FormSection>

            <FormSection title="Реквизиты" icon="file">
              <FormRow>
                <FormField label="УНП / ИНН" value={carrier.inn || carrier.unp} onChange={(v: string) => update({ inn: v, unp: v })} placeholder="123456789" />
                <FormField label="Директор" value={carrier.director || ''} onChange={(v: string) => update({ director: v })} placeholder="Иванов И.И." />
              </FormRow>
              <FormField label="Юридический адрес" value={carrier.legal_address || carrier.address} onChange={(v: string) => update({ legal_address: v, address: v })} placeholder="г. Минск, ул. Ленина, д. 1" />
              <FormField label="Почтовый адрес" value={carrier.postal_address || ''} onChange={(v: string) => update({ postal_address: v })} placeholder="220000 г. Минск, а/я 1" />

              <View>
                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Основание</Text>
                <TouchableOpacity onPress={() => setBasisOpen(true)} activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.bg, borderRadius: 10, borderWidth: 0.5, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 10 }}
                >
                  <Text style={{ color: carrier.basis ? theme.colors.textPrimary : theme.colors.textTertiary, fontSize: 14 }}>
                    {BASIS_OPTIONS.find(o => o.id === carrier.basis)?.label || 'Выбрать…'}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
                </TouchableOpacity>
              </View>
            </FormSection>

            <FormSection title="Банковские реквизиты" icon="bank">
              <FormField label="Название банка" value={carrier.bank_name || carrier.bank} onChange={(v: string) => update({ bank_name: v, bank: v })} placeholder="ОАО 'БелВЭБ'" />
              <FormRow>
                <FormField label="Расчётный счёт" value={carrier.bank_account || carrier.rs} onChange={(v: string) => update({ bank_account: v, rs: v })} placeholder="BY00 BANK 0000..." mono />
                <FormField label="БИК" value={carrier.bank_bik || carrier.bik} onChange={(v: string) => update({ bank_bik: v, bik: v })} placeholder="BELVBY2X" mono />
              </FormRow>
            </FormSection>

            <FormSection title="Дополнительно" icon="info">
              <FormField label="Что возят" value={carrier.cargo_types} onChange={(v: string) => update({ cargo_types: v })} placeholder="Оборудование, ТНП..." />
              <FormField label="Регионы работы" value={carrier.regions} onChange={(v: string) => update({ regions: v })} placeholder="Россия, Беларусь, Европа..." />
              <FormField label="Заметки" value={carrier.notes} onChange={(v: string) => update({ notes: v })} placeholder="Особые условия..." multiline />
            </FormSection>

            <TouchableOpacity onPress={save} disabled={saving} testID="save-carrier-btn"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.accent, borderRadius: 14, paddingVertical: 16, marginTop: 4, shadowColor: theme.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, opacity: saving ? 0.6 : 1 }}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Сохранить</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Basis modal */}
      <Modal visible={basisOpen} transparent animationType="fade" onRequestClose={() => setBasisOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setBasisOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 }} onPress={() => {}}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' }}>Основание</Text>
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
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: active ? theme.colors.accent + '10' : 'transparent' }}
                    onPress={() => { update({ basis: item.id }); setBasisOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: active ? theme.colors.accent : theme.colors.textPrimary, fontSize: 15, fontWeight: '500', flex: 1 }}>{item.label}</Text>
                    {active && <Check size={16} color={theme.colors.accent} strokeWidth={2} />}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── View-mode helpers ────────────────────────────────────────────────────────
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
    <View style={{ marginBottom: 0 }}>
      <Text style={styles.sectionTitle}>ИСТОРИЯ ЗАЯВОК</Text>
      <View style={styles.section}>
        {count === 0 ? (
          <Text style={styles.emptyOrders}>Нет заявок</Text>
        ) : (
          orders.map((o, i) => (
            <TouchableOpacity key={o.id} onPress={() => onPress(o.id)}
              style={[styles.orderRow, i === count - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNum}>№{o.order_number}</Text>
                <Text style={styles.orderRoute} numberOfLines={1}>{o.route_from} → {o.route_to}</Text>
                {!!o.load_date && <Text style={styles.orderDate}>{o.load_date}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.orderRate}>{o[rateKey] ? `${Number(o[rateKey]).toLocaleString()} Br` : '—'}</Text>
                <Text style={[styles.orderStatus, { color: statusColor(o.status) }]}>{STATUS_LABELS[o.status] || o.status}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        {count > 0 && (
          <View style={styles.orderTotals}>
            <Text style={styles.orderTotalsLabel}>Итого {count} {word}</Text>
            <Text style={styles.orderTotalsValue}>{Number(total).toLocaleString()} Br</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ marginBottom: 0 }}>
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

  headerCard: { backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border, borderRadius: 16, padding: 20, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 14, backgroundColor: theme.colors.accent + '15', borderWidth: 1, borderColor: theme.colors.accent + '40', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  contact: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  rating: { color: theme.colors.accent, fontSize: 14, fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.colors.accent, borderRadius: 10 },
  callText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 8, marginLeft: 4 },
  section: { backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: '600', minWidth: 110 },
  rowValue: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '500', textAlign: 'right', flexShrink: 1 },

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
