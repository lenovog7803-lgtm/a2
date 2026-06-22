import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Linking, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Trash2, Copy, Check, FileText, ExternalLink, Calendar, History, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Picker } from '../../src/components/Picker';
import { DateField } from '../../src/components/DateField';

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
};

const countBusinessDays = (from: Date, to: Date): number => {
  let count = 0;
  const cur = new Date(from);
  while (cur < to) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
  }
  return count;
};

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  return `${d[2]}.${d[1]}.${d[0]}`;
};

const statusMap: Record<string, { label: string; color: string }> = {
  new:         { label: 'Новая',      color: '#7C3AED' },
  in_progress: { label: 'В работе',   color: '#2563EB' },
  delivered:   { label: 'Доставлено', color: '#16A34A' },
  cancelled:   { label: 'Отменена',   color: '#9CA3AF' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: theme.colors.border }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function FieldLabel({ children, style }: any) {
  return (
    <Text style={[{ fontSize: 10, fontWeight: '600', color: theme.colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }, style]}>
      {children}
    </Text>
  );
}

const fieldStyle: any = {
  backgroundColor: theme.colors.bg,
  borderRadius: 10,
  borderWidth: 0.5,
  borderColor: theme.colors.border,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  color: theme.colors.textPrimary,
};

export default function OrderDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genKind, setGenKind] = useState<string | null>(null);
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const openOrGenerate = async (kind: 'client' | 'carrier' | 'act') => {
    const field = kind === 'client' ? 'doc_url_client' : kind === 'carrier' ? 'doc_url_carrier' : 'doc_url_act';
    const existing = order?.[field];
    if (existing) {
      Linking.openURL(existing);
      return;
    }
    if (!order?.client_name && kind !== 'carrier') {
      Alert.alert('Сначала выберите клиента');
      return;
    }
    if (!order?.carrier_name && kind === 'carrier') {
      Alert.alert('Сначала выберите перевозчика');
      return;
    }
    setGenKind(kind);
    try {
      const r = await api.orders.generateDoc(id!, kind);
      if (r?.url) {
        setOrder({ ...order, [field]: r.url });
        Linking.openURL(r.url);
      }
    } catch (e: any) {
      Alert.alert('Не удалось создать документ', e?.message || 'Проверьте, что вы открыли доступ сервис-аккаунту к шаблонам и папкам');
    } finally {
      setGenKind(null);
    }
  };

  const regenerateDoc = (kind: 'client' | 'carrier' | 'act') => {
    Alert.alert(
      'Перегенерировать?',
      'Будет создан НОВЫЙ документ (старый останется на Drive). Продолжить?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Создать заново',
          style: 'destructive',
          onPress: async () => {
            setGenKind(kind);
            try {
              const r = await api.orders.generateDoc(id!, kind, true);
              const field = kind === 'client' ? 'doc_url_client' : kind === 'carrier' ? 'doc_url_carrier' : 'doc_url_act';
              if (r?.url) {
                setOrder({ ...order, [field]: r.url });
                Linking.openURL(r.url);
              }
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Сбой генерации');
            } finally {
              setGenKind(null);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    (async () => {
      try {
        const [o, cl, cr] = await Promise.all([api.orders.get(id!), api.clients.list(), api.carriers.list()]);
        setOrder(o); setClients(cl); setCarriers(cr);
      } catch (e: any) {
        Alert.alert('Ошибка', e.message);
        router.back();
      } finally { setLoading(false); }
    })();
  }, [id]);

  const update = (patch: any) => setOrder({ ...order, ...patch });

  const selectClient = (c: any) => update({ client_id: c.id, client_name: c.name });
  const selectCarrier = (c: any) => {
    const parts = [c.vehicle_type, c.plate, c.driver_name, c.phone].filter(Boolean);
    update({
      carrier_id: c.id,
      carrier_name: c.company_name,
      driver_name: parts.length ? parts.join('\n') : order.driver_name,
    });
  };

  const save = async () => {
    setSaving(true);
    try { await api.orders.update(order.id, order); router.back(); }
    catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Удалить заявку ${order?.order_number || ''}?`)) return;
    } else {
      await new Promise<void>((resolve, reject) => {
        Alert.alert('Удалить заявку?', order?.order_number || '', [
          { text: 'Отмена', style: 'cancel', onPress: () => reject(new Error('cancelled')) },
          { text: 'Удалить', style: 'destructive', onPress: () => resolve() },
        ]);
      }).catch(() => { throw new Error('cancelled'); });
    }
    try {
      await api.orders.remove(id!);
      if (Platform.OS === 'web') {
        window.alert('Заявка удалена');
      } else {
        Alert.alert('Готово', 'Заявка удалена');
      }
      router.replace('/(tabs)/orders' as any);
    } catch (e: any) {
      if (e?.message === 'cancelled') return;
      if (Platform.OS === 'web') {
        window.alert('Ошибка: ' + (e?.message || JSON.stringify(e)));
      } else {
        Alert.alert('Ошибка удаления', e?.message || 'Не удалось удалить');
      }
    }
  };

  const duplicateOrder = () => {
    router.push({ pathname: '/order/new', params: { duplicateFrom: id } } as any);
  };

  const openLogs = async () => {
    setLogsVisible(true);
    setLogsLoading(true);
    try {
      const data = await api.orders.logs(id!);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const margin = (order.client_rate || 0) - (order.carrier_rate || 0);
  const daysLeft = order.carrier_payment_deadline
    ? countBusinessDays(new Date(), new Date(order.carrier_payment_deadline))
    : null;
  const deadlineColor = daysLeft !== null
    ? (daysLeft <= 3 ? '#FF3B30' : daysLeft <= 5 ? '#FF9500' : theme.colors.textSecondary)
    : theme.colors.textSecondary;
  const paymentProgress = [order.client_paid, order.carrier_paid].filter(Boolean).length * 50;
  const { label: statusLabel, color: statusColor } = statusMap[order.status] || { label: order.status, color: '#6B7280' };

  const clientItems = clients.map(c => ({ id: c.id, label: c.name, sublabel: c.contact_person || c.phone }));
  const carrierItems = carriers.map(c => ({ id: c.id, label: c.company_name, sublabel: `${c.driver_name || ''} · ${c.plate || ''}` }));

  const renderRightContent = () => (
    <>
      {/* Оплаты */}
      <Section title="Оплаты">
        <DocToggle
          label="Клиент оплатил"
          value={order.client_paid}
          onToggle={() => {
            const next = !order.client_paid;
            update({ client_paid: next, client_paid_date: next && !order.client_paid_date ? new Date().toISOString().slice(0, 10) : order.client_paid_date });
          }}
          amount={(order.client_rate || 0).toLocaleString('ru-RU') + ' Br'}
          paidDate={order.client_paid_date || (order.client_paid ? order.created_at?.slice(0, 10) : '')}
        />
        <View style={{ marginVertical: 8 }}>
          <FieldLabel>Банковских дней на оплату перевозчика</FieldLabel>
          <TextInput
            value={String(order.carrier_payment_days ?? 20)}
            onChangeText={(v) => update({ carrier_payment_days: parseInt(v) || 20 })}
            keyboardType="numeric"
            style={fieldStyle}
          />
        </View>
        <DocToggle
          label="Перевозчик оплачен"
          value={order.carrier_paid}
          onToggle={() => {
            const next = !order.carrier_paid;
            update({ carrier_paid: next, carrier_paid_date: next && !order.carrier_paid_date ? new Date().toISOString().slice(0, 10) : order.carrier_paid_date });
          }}
          amount={(order.carrier_rate || 0).toLocaleString('ru-RU') + ' Br'}
          paidDate={order.carrier_paid_date || (order.carrier_paid ? order.created_at?.slice(0, 10) : '')}
          daysLeft={daysLeft}
          deadlineColor={deadlineColor}
        />

        {/* Прогресс-бар */}
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ fontSize: 10, color: theme.colors.textTertiary }}>Выполнение оплат</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.accent }}>{paymentProgress}%</Text>
          </View>
          <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${paymentProgress}%` as any, height: 6, overflow: 'hidden' }}>
              <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 6, minWidth: 6 }} />
            </View>
          </View>
        </View>
      </Section>

      {/* Документооборот */}
      <Section title="Документооборот">
        <DocToggle
          label="Документы отправлены клиенту"
          value={order.docs_to_client_sent}
          onToggle={() => {
            const next = !order.docs_to_client_sent;
            update({ docs_to_client_sent: next, docs_to_client_date: next && !order.docs_to_client_date ? new Date().toISOString().slice(0, 10) : order.docs_to_client_date });
          }}
          onText="Отправлены"
          offText="Не отправлены"
          docDate={order.docs_to_client_date}
          testID="doc-to-client"
        />
        <DocToggle
          label="Документы получены от клиента"
          value={order.docs_from_client_received}
          onToggle={() => {
            const next = !order.docs_from_client_received;
            update({ docs_from_client_received: next, docs_from_client_date: next && !order.docs_from_client_date ? new Date().toISOString().slice(0, 10) : order.docs_from_client_date });
          }}
          onText="Получены"
          offText="Не получены"
          docDate={order.docs_from_client_date}
          testID="doc-from-client"
        />
        <DocToggle
          label="Документы отправлены перевозчику"
          value={order.docs_to_carrier_sent}
          onToggle={() => {
            const next = !order.docs_to_carrier_sent;
            update({ docs_to_carrier_sent: next, docs_to_carrier_date: next && !order.docs_to_carrier_date ? new Date().toISOString().slice(0, 10) : order.docs_to_carrier_date });
          }}
          onText="Отправлены"
          offText="Не отправлены"
          docDate={order.docs_to_carrier_date}
          testID="doc-to-carrier"
        />
        <DocToggle
          label="Документы получены от перевозчика"
          value={order.docs_from_carrier_received}
          onToggle={() => {
            const next = !order.docs_from_carrier_received;
            update({ docs_from_carrier_received: next, docs_from_carrier_date: next && !order.docs_from_carrier_date ? new Date().toISOString().slice(0, 10) : order.docs_from_carrier_date });
          }}
          onText="Получены"
          offText="Не получены"
          docDate={order.docs_from_carrier_date}
          testID="doc-from-carrier"
        />
      </Section>

      {/* Google Docs */}
      <Section title="Google Docs">
        {([
          { label: 'Заявка клиенту',      kind: 'client'  as const, url: order.doc_url_client,  color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Договор перевозчику',  kind: 'carrier' as const, url: order.doc_url_carrier, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Счёт-Акт',            kind: 'act'     as const, url: order.doc_url_act,     color: '#16A34A', bg: '#F0FDF4' },
        ]).map((doc, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => openOrGenerate(doc.kind)}
            onLongPress={() => doc.url && regenerateDoc(doc.kind)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: theme.colors.bg, marginBottom: i < 2 ? 8 : 0, borderWidth: 0.5, borderColor: theme.colors.border }}
            activeOpacity={0.7}
          >
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: doc.bg, alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={15} color={doc.color} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary }}>{doc.label}</Text>
              <Text style={{ fontSize: 10, color: doc.url ? doc.color : theme.colors.textTertiary, marginTop: 1 }}>
                {genKind === doc.kind ? 'Создаётся...' : doc.url ? 'Готов · открыть' : 'Нажмите для создания'}
              </Text>
            </View>
            {doc.url && <ExternalLink size={13} color={theme.colors.textTertiary} strokeWidth={1.8} />}
          </TouchableOpacity>
        ))}
      </Section>
    </>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>

      {/* Шапка */}
      <View style={{
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 20,
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <TouchableOpacity testID="close-btn" onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft size={16} color={theme.colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: -0.3 }} numberOfLines={1}>
                {order.order_number}
              </Text>
              <View style={{ backgroundColor: statusColor + '20', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
              </View>
            </View>
            {!!order.created_at && (
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 }}>
                Создана {formatDate(order.created_at)}
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: theme.colors.textTertiary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 }}>Маржа</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#16A34A', letterSpacing: -0.5 }}>
              {margin > 0 ? '+' : ''}{margin.toLocaleString('ru-RU')} Br
            </Text>
          </View>
          <View style={{ width: 0.5, height: 28, backgroundColor: theme.colors.border }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: theme.colors.textTertiary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ставка</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: -0.5 }}>
              {(order.client_rate || 0).toLocaleString('ru-RU')} Br
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity testID="duplicate-btn" onPress={duplicateOrder} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
              <Copy size={15} color={theme.colors.textSecondary} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity testID="delete-btn" onPress={handleDelete} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={15} color="#EF4444" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{
          flexDirection: Platform.OS === 'web' ? 'row' : 'column',
          gap: 12,
          padding: 12,
          alignItems: 'flex-start',
        }}>

          {/* Левая колонка */}
          <View style={{ flex: Platform.OS === 'web' ? 1 : undefined, gap: 10, ...(Platform.OS !== 'web' ? { width: '100%' } : {}) }}>

            {/* Стороны */}
            <Section title="Стороны">
              <FieldLabel>Номер заявки</FieldLabel>
              <TextInput
                value={order.order_number || ''}
                onChangeText={(v) => update({ order_number: v })}
                style={[fieldStyle, { marginBottom: 12 }]}
              />
              <Picker label="Клиент" value={order.client_id || ''} items={clientItems} onSelect={selectClient} placeholder="Выбрать клиента…" testID="picker-client" />
              <Picker label="Перевозчик" value={order.carrier_id || ''} items={carrierItems} onSelect={selectCarrier} placeholder="Выбрать перевозчика…" testID="picker-carrier" />
              {!!order.carrier_id && (
                <TouchableOpacity onPress={() => router.push(`/carrier/${order.carrier_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }} activeOpacity={0.7}>
                  <ExternalLink size={13} color={theme.colors.accent} strokeWidth={1.8} />
                  <Text style={{ fontSize: 12, color: theme.colors.accent, fontWeight: '500' }}>Карточка перевозчика</Text>
                </TouchableOpacity>
              )}
            </Section>

            {/* Маршрут и груз */}
            <Section title="Маршрут и груз">
              <View style={{ backgroundColor: theme.colors.bg, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: theme.colors.border }}>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                  {/* Вертикальная линия */}
                  <View style={{ alignItems: 'center', paddingTop: 6, width: 12 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.accent }} />
                    <View style={{ flex: 1, marginVertical: 3, gap: 2, alignItems: 'center' }}>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <View key={i} style={{ width: 1.5, height: 4, backgroundColor: i % 2 === 0 ? '#CBD5E1' : 'transparent' }} />
                      ))}
                    </View>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#9CA3AF' }} />
                  </View>

                  {/* Поля маршрута */}
                  <View style={{ flex: 1 }}>
                    {/* Откуда */}
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                        Загрузка (Откуда)
                      </Text>
                      <TextInput
                        value={order.route_from || ''}
                        onChangeText={(v) => update({ route_from: v })}
                        placeholder="Город загрузки"
                        placeholderTextColor={theme.colors.textTertiary}
                        style={fieldStyle}
                      />
                      <Text style={{ fontSize: 9, color: theme.colors.textTertiary, marginTop: 8, marginBottom: 4 }}>Точный адрес</Text>
                      <TextInput
                        value={order.route_from_address || ''}
                        onChangeText={(v) => update({ route_from_address: v })}
                        placeholder="Адрес загрузки"
                        placeholderTextColor={theme.colors.textTertiary}
                        style={[fieldStyle, { fontSize: 12 }]}
                        multiline
                      />
                      <View style={{ marginTop: 8 }}>
                        <DateField label="Дата загрузки" value={order.load_date} onChange={(v: string) => update({ load_date: v })} />
                      </View>
                    </View>

                    {/* Куда */}
                    <View>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                        Выгрузка (Куда)
                      </Text>
                      <TextInput
                        value={order.route_to || ''}
                        onChangeText={(v) => update({ route_to: v })}
                        placeholder="Город выгрузки"
                        placeholderTextColor={theme.colors.textTertiary}
                        style={fieldStyle}
                      />
                      <Text style={{ fontSize: 9, color: theme.colors.textTertiary, marginTop: 8, marginBottom: 4 }}>Точный адрес</Text>
                      <TextInput
                        value={order.route_to_address || ''}
                        onChangeText={(v) => update({ route_to_address: v })}
                        placeholder="Адрес выгрузки"
                        placeholderTextColor={theme.colors.textTertiary}
                        style={[fieldStyle, { fontSize: 12 }]}
                        multiline
                      />
                      <View style={{ marginTop: 8 }}>
                        <DateField label="Дата выгрузки" value={order.unload_date} onChange={(v: string) => update({ unload_date: v })} />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Груз — 3 поля в ряд */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { label: 'Груз', field: 'cargo', value: order.cargo || '', numeric: false },
                    { label: 'Вес, т', field: 'weight_tons', value: String(order.weight_tons || ''), numeric: true },
                    { label: 'Данные ТС', field: 'driver_name', value: order.driver_name || '', numeric: false },
                  ].map((item) => (
                    <View key={item.field} style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: 8, padding: 8, borderWidth: 0.5, borderColor: theme.colors.border }}>
                      <Text style={{ fontSize: 9, color: theme.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        {item.label}
                      </Text>
                      <TextInput
                        value={item.value}
                        onChangeText={(v) => update({ [item.field]: item.numeric ? parseFloat(v) || 0 : v })}
                        keyboardType={item.numeric ? 'numeric' : 'default'}
                        style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary, minHeight: 22 }}
                        placeholderTextColor={theme.colors.textTertiary}
                        multiline={!item.numeric}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </Section>

            {/* Статус */}
            <Section title="Статус">
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'new',         label: 'Новая',      color: '#7C3AED', bg: '#EDE9FE' },
                  { id: 'in_progress', label: 'В работе',   color: '#2563EB', bg: '#DBEAFE' },
                  { id: 'delivered',   label: 'Доставлено', color: '#16A34A', bg: '#DCFCE7' },
                  { id: 'cancelled',   label: 'Отменено',   color: '#6B7280', bg: '#F3F4F6' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => update({ status: s.id })}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: order.status === s.id ? s.bg : theme.colors.surfaceElevated,
                      borderWidth: 0.5,
                      borderColor: order.status === s.id ? s.color + '40' : theme.colors.border,
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontWeight: order.status === s.id ? '600' : '400', color: order.status === s.id ? s.color : theme.colors.textSecondary }}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            {/* Финансы */}
            <Section title="Финансы">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Ставка клиента, Br</FieldLabel>
                  <TextInput
                    value={String(order.client_rate || '')}
                    onChangeText={(v) => update({ client_rate: parseFloat(v) || 0 })}
                    keyboardType="numeric"
                    style={fieldStyle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Ставка перевозчика, Br</FieldLabel>
                  <TextInput
                    value={String(order.carrier_rate || '')}
                    onChangeText={(v) => update({ carrier_rate: parseFloat(v) || 0 })}
                    keyboardType="numeric"
                    style={fieldStyle}
                  />
                </View>
              </View>
            </Section>

            {/* Заметки */}
            <Section title="Заметки">
              <TextInput
                value={order.notes || ''}
                onChangeText={(v) => update({ notes: v })}
                multiline
                placeholder="Внутренние заметки..."
                placeholderTextColor={theme.colors.textTertiary}
                style={[fieldStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              />
            </Section>

            {/* На мобиле — правый контент здесь */}
            {Platform.OS !== 'web' && renderRightContent()}

            {/* Календарь */}
            {!!order.calendar_event_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(order.calendar_event_url)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 0.5, borderColor: theme.colors.accent + '50' }}
                activeOpacity={0.8}
              >
                <Calendar size={15} color={theme.colors.accent} strokeWidth={1.8} />
                <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>Открыть в Calendar</Text>
              </TouchableOpacity>
            )}

            {/* История */}
            <TouchableOpacity
              onPress={openLogs}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 0.5, borderColor: theme.colors.border }}
              activeOpacity={0.8}
            >
              <History size={15} color={theme.colors.textSecondary} strokeWidth={1.8} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>История изменений</Text>
            </TouchableOpacity>
          </View>

          {/* Правая колонка (только веб) */}
          {Platform.OS === 'web' && (
            <View style={{ width: 300, gap: 10 }}>
              {renderRightContent()}
            </View>
          )}
        </View>

        {/* Кнопка сохранить */}
        <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
          <TouchableOpacity
            testID="save-btn"
            onPress={save}
            disabled={saving}
            style={{ backgroundColor: theme.colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: saving ? 0.6 : 1, shadowColor: theme.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Сохранить</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Модал: история */}
      <Modal visible={logsVisible} transparent animationType="slide" onRequestClose={() => setLogsVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setLogsVisible(false)} />
          <View style={{ backgroundColor: theme.colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary }}>История изменений</Text>
              <TouchableOpacity onPress={() => setLogsVisible(false)} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            {logsLoading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 32 }} />
            ) : logs.length === 0 ? (
              <Text style={{ textAlign: 'center', color: theme.colors.textTertiary, paddingVertical: 32, fontSize: 14 }}>Изменений нет</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {logs.map((log, i) => (
                  <View key={log.id || i} style={{ paddingVertical: 12, borderBottomWidth: i < logs.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginBottom: 4 }}>{log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : '—'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>{log.field}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text style={{ flex: 1, fontSize: 12, color: theme.colors.loss, fontWeight: '500' }} numberOfLines={2}>{log.old_value || '—'}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>→</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: theme.colors.profit, fontWeight: '500' }} numberOfLines={2}>{log.new_value || '—'}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>{log.user}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function DocToggle({ label, value, onToggle, onText, offText, amount, paidDate, docDate, daysLeft, deadlineColor, testID }: any) {
  const display = value ? (onText || 'Готово') : (offText || 'Ждём');
  const formattedPaidDate = paidDate ? paidDate.slice(0, 10).split('-').reverse().join('.') : null;
  const formattedDocDate = docDate ? docDate.slice(0, 10).split('-').reverse().join('.') : null;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: value ? theme.colors.profit + '08' : theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: value ? theme.colors.profit + '40' : theme.colors.border, marginBottom: 8 }}
      activeOpacity={0.7}
    >
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: value ? 0 : 1.5, borderColor: theme.colors.borderStrong, backgroundColor: value ? theme.colors.profit : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {value && <Check size={12} color="#000" strokeWidth={3} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: '500', marginTop: 2, color: value ? theme.colors.profit : theme.colors.textTertiary }}>{display}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {!!amount && <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{amount}</Text>}
        {!value && daysLeft !== null && daysLeft !== undefined && (
          <View style={{ backgroundColor: (deadlineColor || theme.colors.textSecondary) + '18', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: deadlineColor || theme.colors.textSecondary }}>{`${daysLeft} дн.`}</Text>
          </View>
        )}
        {value && !!formattedPaidDate && <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>оплачено {formattedPaidDate}</Text>}
        {value && !!formattedDocDate && <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>{formattedDocDate}</Text>}
      </View>
    </TouchableOpacity>
  );
}
