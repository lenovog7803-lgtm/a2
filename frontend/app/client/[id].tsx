import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Linking, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Trash2, Edit3, Phone, Mail, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { MiniChart } from '../../src/components/MiniChart';

const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export default function ClientDetail() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [acts, setActs] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, allOrders] = await Promise.all([api.clients.get(id!), api.orders.list()]);
        setClient(c);
        setOrders(allOrders.filter((o: any) => o.client_name === c.name));
      } catch (e: any) {
        Alert.alert('Ошибка', e.message);
        router.back();
      } finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => {
    if (id) {
      api.reconciliation.history({ counterparty_id: id, type: 'client' })
        .then((data: any[]) => setActs(data || []))
        .catch(() => {});
    }
  }, [id]);

  const update = (patch: any) => setClient((prev: any) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const { id: _id, created_at, ...payload } = client;
      await api.clients.update(client.id, payload);
      setEditing(false);
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setSaving(false); }
  };

  const remove = () => {
    Alert.alert('Удалить клиента?', client?.name || '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await api.clients.delete(client.id);
          router.back();
        } catch (e: any) {
          Alert.alert('Ошибка', e.message);
        }
      }},
    ]);
  };

  const generateAllActs = async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Сгенерировать акты+счета для всех заявок ${client?.name}?`)) return;
    } else {
      await new Promise<void>(resolve => {
        Alert.alert(
          'Генерация документов',
          `Сгенерировать акты+счета для всех заявок ${client?.name}?`,
          [{ text: 'Отмена', style: 'cancel', onPress: () => resolve() }, { text: 'Да', onPress: () => resolve() }],
        );
      });
    }
    setGenerating(true);
    try {
      const result = await api.clients.generateActs(id!);
      setGenResult(result);
      if (result?.url) {
        if (Platform.OS === 'web') {
          window.open(result.url, '_blank');
        } else {
          await Linking.openURL(result.url);
        }
      }
      const msg = `Создано: ${result.created}, ошибок: ${result.errors}`;
      if (Platform.OS === 'web') {
        window.alert('Готово! ' + msg);
      } else {
        Alert.alert('Готово', msg);
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert('Ошибка: ' + e.message);
      } else {
        Alert.alert('Ошибка', e.message);
      }
    } finally {
      setGenerating(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Скопировано', `${label}: ${text}`);
    } catch {
      Alert.alert(label, text);
    }
  };

  if (loading || !client) {
    return <View style={[styles.center, { backgroundColor: theme.colors.bg }]}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  const initials = client.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{editing ? 'Редактирование' : 'Клиент'}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn} testID="edit-client-btn">
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
            {/* Header card */}
            <View style={styles.headerCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <Text style={styles.name}>{client.name}</Text>
              {!!client.contact_person && <Text style={styles.contact}>{client.contact_person}</Text>}
              <View style={styles.actionsRow}>
                {!!client.phone && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${client.phone}`)} activeOpacity={0.7}>
                    <Phone size={14} color={theme.colors.accent} strokeWidth={1.6} />
                    <Text style={styles.actionText}>{client.phone}</Text>
                  </TouchableOpacity>
                )}
                {!!client.email && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`mailto:${client.email}`)} activeOpacity={0.7}>
                    <Mail size={14} color={theme.colors.accent} strokeWidth={1.6} />
                    <Text style={styles.actionText}>{client.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Revenue MiniChart */}
            {orders.length > 1 && (() => {
              const last6 = Array.from({ length: 6 }, (_, i) => {
                const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              });
              const revData = last6.map(ym =>
                orders.filter((o: any) => (o.unload_date || o.load_date || '').startsWith(ym))
                      .reduce((s: number, o: any) => s + (o.client_rate || 0), 0)
              );
              if (revData.every((v: number) => v === 0)) return null;
              const mLabels = last6.map(ym => MONTHS_SHORT[parseInt(ym.slice(5), 10) - 1]);
              const chartW = screenW - 40 - 36;
              return (
                <View style={[styles.section, { marginBottom: 12, padding: 14 }]}>
                  <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>ВЫРУЧКА ПО МЕСЯЦАМ</Text>
                  <MiniChart data={revData} width={chartW} height={80} color="#2563EB" showTooltip labels={mLabels} />
                </View>
              );
            })()}

            {/* Реквизиты */}
            {(client.inn || client.kpp || client.legal_address) && (
              <Section title="РЕКВИЗИТЫ">
                <Row label="ИНН" value={client.inn} onCopy={() => copyText(client.inn, 'ИНН')} />
                <Row label="КПП" value={client.kpp} onCopy={() => copyText(client.kpp, 'КПП')} />
                <Row label="Юр. адрес" value={client.legal_address} onCopy={() => copyText(client.legal_address, 'Юр. адрес')} multiline />
              </Section>
            )}

            {/* Банк */}
            {(client.bank_name || client.bank_account) && (
              <Section title="БАНКОВСКИЕ РЕКВИЗИТЫ">
                <Row label="Банк" value={client.bank_name} onCopy={() => copyText(client.bank_name, 'Банк')} />
                <Row label="Расчётный счёт" value={client.bank_account} mono onCopy={() => copyText(client.bank_account, 'Р/с')} />
                <Row label="БИК" value={client.bank_bik} mono onCopy={() => copyText(client.bank_bik, 'БИК')} />
                <Row label="Корр. счёт" value={client.bank_corr_account} mono onCopy={() => copyText(client.bank_corr_account, 'К/с')} />
              </Section>
            )}

            {/* Доп инфо */}
            {(client.payment_terms || client.cargo_types || client.directions || client.notes) && (
              <Section title="ДОПОЛНИТЕЛЬНО">
                <Row label="Условия оплаты" value={client.payment_terms} />
                <Row label="Что возят" value={client.cargo_types} multiline />
                <Row label="Направления" value={client.directions} multiline />
                <Row label="Заметки" value={client.notes} multiline />
              </Section>
            )}

            {/* История заявок */}
            <OrdersHistory
              orders={orders}
              rateKey="client_rate"
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

            {/* Генерация всех актов+счетов */}
            <TouchableOpacity
              onPress={generateAllActs}
              disabled={generating}
              style={{
                backgroundColor: theme.colors.accent,
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 8,
                marginBottom: 8,
                opacity: generating ? 0.6 : 1,
              }}
              activeOpacity={0.8}
            >
              {generating
                ? <ActivityIndicator color="#000" />
                : <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>
                    Сгенерировать все акты+счета
                  </Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Field label="Название" value={client.name} onChangeText={(v: string) => update({ name: v })} />
            <Field label="Контактное лицо" value={client.contact_person} onChangeText={(v: string) => update({ contact_person: v })} />
            <Field label="Телефон" keyboardType="phone-pad" value={client.phone} onChangeText={(v: string) => update({ phone: v })} />
            <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={client.email} onChangeText={(v: string) => update({ email: v })} />

            <Text style={styles.groupLabel}>РЕКВИЗИТЫ</Text>
            <Field label="ИНН" keyboardType="numeric" value={client.inn} onChangeText={(v: string) => update({ inn: v })} />
            <Field label="КПП" keyboardType="numeric" value={client.kpp} onChangeText={(v: string) => update({ kpp: v })} />
            <Field label="Юр. адрес" multiline value={client.legal_address} onChangeText={(v: string) => update({ legal_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />

            <Text style={styles.groupLabel}>БАНК</Text>
            <Field label="Банк" value={client.bank_name} onChangeText={(v: string) => update({ bank_name: v })} />
            <Field label="Расчётный счёт" keyboardType="numeric" value={client.bank_account} onChangeText={(v: string) => update({ bank_account: v })} />
            <Field label="БИК" keyboardType="numeric" value={client.bank_bik} onChangeText={(v: string) => update({ bank_bik: v })} />
            <Field label="Корр. счёт" keyboardType="numeric" value={client.bank_corr_account} onChangeText={(v: string) => update({ bank_corr_account: v })} />

            <Text style={styles.groupLabel}>ДОП ИНФО</Text>
            <Field label="Условия оплаты" value={client.payment_terms} onChangeText={(v: string) => update({ payment_terms: v })} />
            <Field label="Что возят" multiline value={client.cargo_types} onChangeText={(v: string) => update({ cargo_types: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
            <Field label="Направления" multiline value={client.directions} onChangeText={(v: string) => update({ directions: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
            <Field label="Заметки" multiline value={client.notes} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8} testID="save-client-btn">
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
  if (!value) return null;
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
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.accent + '20', borderWidth: 1, borderColor: theme.colors.accent + '40', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: theme.colors.accent, fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  name: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  contact: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  actionText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '500' },

  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 8, marginLeft: 4 },
  section: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: '600', minWidth: 110 },
  rowValue: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '500', textAlign: 'right', flexShrink: 1 },

  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.accent, marginTop: 16, marginBottom: 8 },
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
