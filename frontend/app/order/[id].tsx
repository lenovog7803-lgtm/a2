import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Linking, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Trash2, Copy, Check, AlertTriangle, FileText, ExternalLink, RefreshCw, Calendar, History } from 'lucide-react-native';
import { theme, formatMoney, statusLabels } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { Picker } from '../../src/components/Picker';
import { DateField } from '../../src/components/DateField';

const STATUS_OPTIONS = ['new', 'in_progress', 'delivered', 'cancelled'];

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
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
        // обновим стейт, чтобы кнопка стала "открыть"
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

  const remove = () => {
    Alert.alert('Удалить заявку?', order?.order_number || '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await api.orders.delete(order.id);
          router.back();
        } catch (e: any) {
          Alert.alert('Ошибка', e.message);
        }
      }},
    ]);
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
    return <View style={[styles.center, { backgroundColor: theme.colors.bg }]}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  const margin = (order.client_rate || 0) - (order.carrier_rate || 0);
  const overdue = !order.client_paid && daysSince(order.load_date) >= 15;
  const days = daysSince(order.load_date);

  const formatCreatedAt = (iso: string) => {
    if (!iso) return '—';
    const d = iso.slice(0, 10).split('-');
    return `${d[2]}.${d[1]}.${d[0]}`;
  };

  const clientItems = clients.map(c => ({ id: c.id, label: c.name, sublabel: c.contact_person || c.phone }));
  const carrierItems = carriers.map(c => ({ id: c.id, label: c.company_name, sublabel: `${c.driver_name || ''} · ${c.plate || ''}` }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="close-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{order.order_number}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity testID="duplicate-btn" onPress={duplicateOrder} style={styles.iconBtn}>
            <Copy size={18} color={theme.colors.accent} strokeWidth={1.6} />
          </TouchableOpacity>
          <TouchableOpacity testID="delete-btn" onPress={remove} style={styles.iconBtn}>
            <Trash2 size={18} color={theme.colors.loss} strokeWidth={1.6} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}>
        {overdue && (
          <View style={styles.overdueBanner}>
            <AlertTriangle size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.overdueText}>ПРОСРОЧКА · {days} ДН. БЕЗ ОПЛАТЫ ОТ КЛИЕНТА</Text>
          </View>
        )}

        <View style={styles.summary}>
          <View>
            <Text style={styles.sumLabel}>МАРЖА</Text>
            <Text style={[styles.sumValue, { color: margin >= 0 ? theme.colors.profit : theme.colors.loss }]}>{formatMoney(margin)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.sumLabel}>СТАВКА КЛИЕНТА</Text>
            <Text style={styles.sumValue}>{formatMoney(order.client_rate)}</Text>
          </View>
        </View>

        {!!order.created_at && (
          <View style={styles.createdAtRow}>
            <Text style={styles.createdAtLabel}>Дата заявки</Text>
            <Text style={styles.createdAtValue}>{formatCreatedAt(order.created_at)}</Text>
          </View>
        )}

        <Field label="Номер заявки" value={order.order_number} onChangeText={(v: string) => update({ order_number: v })} />

        <Picker label="Клиент" value={order.client_id || ''} items={clientItems} onSelect={selectClient} placeholder="Выбрать клиента…" testID="picker-client" />
        <Picker label="Перевозчик" value={order.carrier_id || ''} items={carrierItems} onSelect={selectCarrier} placeholder="Выбрать перевозчика…" testID="picker-carrier" />
        {!!order.carrier_id && (
          <TouchableOpacity
            onPress={() => router.push(`/carrier/${order.carrier_id}`)}
            style={styles.entityLink}
            activeOpacity={0.7}
          >
            <ExternalLink size={13} color={theme.colors.accent} strokeWidth={1.8} />
            <Text style={styles.entityLinkText}>Карточка перевозчика</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.groupLabel}>МАРШРУТ</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Откуда (город)" value={order.route_from} onChangeText={(v: string) => update({ route_from: v })} /></View>
          <View style={{ flex: 1 }}><Field label="Куда (город)" value={order.route_to} onChangeText={(v: string) => update({ route_to: v })} /></View>
        </View>
        <Field label="Точный адрес загрузки" multiline value={order.route_from_address} onChangeText={(v: string) => update({ route_from_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Точный адрес выгрузки" multiline value={order.route_to_address} onChangeText={(v: string) => update({ route_to_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><DateField label="Дата загрузки" value={order.load_date} onChange={(v: string) => update({ load_date: v })} /></View>
          <View style={{ flex: 1 }}><DateField label="Дата выгрузки" value={order.unload_date} onChange={(v: string) => update({ unload_date: v })} /></View>
        </View>

        <Text style={styles.groupLabel}>ДАННЫЕ ПО ВОДИТЕЛЮ И ТС</Text>
        <Field label="Данные на ТС" multiline value={order.driver_name || ''} onChangeText={(v: string) => update({ driver_name: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

        <Text style={styles.groupLabel}>ГРУЗ И СТАВКИ</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Ставка клиента, Br" keyboardType="numeric" value={String(order.client_rate || '')} onChangeText={(v: string) => update({ client_rate: parseFloat(v) || 0 })} /></View>
          <View style={{ flex: 1 }}><Field label="Ставка перев., Br" keyboardType="numeric" value={String(order.carrier_rate || '')} onChangeText={(v: string) => update({ carrier_rate: parseFloat(v) || 0 })} /></View>
        </View>
        <Field label="Груз" value={order.cargo} onChangeText={(v: string) => update({ cargo: v })} />
        <Field label="Вес, тонн" keyboardType="numeric" value={String(order.weight_tons || '')} onChangeText={(v: string) => update({ weight_tons: parseFloat(v) || 0 })} />

        <Text style={styles.groupLabel}>СТАТУС</Text>
        <View style={styles.choiceRow}>
          {STATUS_OPTIONS.map(s => (
            <TouchableOpacity key={s} onPress={() => update({ status: s })} style={[styles.choice, order.status === s && styles.choiceActive]} activeOpacity={0.7}>
              <Text style={[styles.choiceText, order.status === s && styles.choiceTextActive]}>{statusLabels[s]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.groupLabel}>ОПЛАТЫ</Text>
        <DocToggle
          label="Клиент оплатил"
          value={order.client_paid}
          onToggle={() => {
            const next = !order.client_paid;
            update({ client_paid: next, client_paid_date: next && !order.client_paid_date ? new Date().toISOString().slice(0, 10) : order.client_paid_date });
          }}
          amount={formatMoney(order.client_rate)}
          paidDate={order.client_paid_date || (order.client_paid ? order.created_at?.slice(0, 10) : '')}
        />
        <DocToggle
          label="Перевозчик оплачен"
          value={order.carrier_paid}
          onToggle={() => {
            const next = !order.carrier_paid;
            update({ carrier_paid: next, carrier_paid_date: next && !order.carrier_paid_date ? new Date().toISOString().slice(0, 10) : order.carrier_paid_date });
          }}
          amount={formatMoney(order.carrier_rate)}
          paidDate={order.carrier_paid_date || (order.carrier_paid ? order.created_at?.slice(0, 10) : '')}
        />

        <Text style={styles.groupLabel}>ДОКУМЕНТЫ</Text>
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

        <Field label="Заметки" multiline value={order.notes} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 80, textAlignVertical: 'top', marginTop: 16 }} />

        <Text style={styles.groupLabel}>ДОКУМЕНТЫ GOOGLE DOCS</Text>
        <DocGenButton label="Заявка клиенту" url={order.doc_url_client} />
        <DocGenButton label="Договор-заявка перевозчику" url={order.doc_url_carrier} />
        <DocGenButton label="Счёт-Акт" url={order.doc_url_act} />

        {!!order.calendar_event_url && (
          <TouchableOpacity onPress={() => Linking.openURL(order.calendar_event_url)} style={styles.calBtn} activeOpacity={0.8}>
            <Calendar size={15} color={theme.colors.accent} strokeWidth={1.8} />
            <Text style={styles.calBtnText}>Открыть в Calendar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={openLogs} style={styles.logsBtn} activeOpacity={0.8}>
          <History size={15} color={theme.colors.textSecondary} strokeWidth={1.8} />
          <Text style={styles.logsBtnText}>История изменений</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="save-btn" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Сохранить</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={logsVisible} transparent animationType="slide" onRequestClose={() => setLogsVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setLogsVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>История изменений</Text>
              <TouchableOpacity onPress={() => setLogsVisible(false)} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            {logsLoading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 32 }} />
            ) : logs.length === 0 ? (
              <Text style={styles.emptyLogs}>Изменений нет</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {logs.map((log, i) => (
                  <View key={log.id || i} style={[styles.logRow, i === logs.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.logDate}>{log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : '—'}</Text>
                    <Text style={styles.logField}>{log.field}</Text>
                    <View style={styles.logValues}>
                      <Text style={styles.logOld} numberOfLines={2}>{log.old_value || '—'}</Text>
                      <Text style={styles.logArrow}>→</Text>
                      <Text style={styles.logNew} numberOfLines={2}>{log.new_value || '—'}</Text>
                    </View>
                    <Text style={styles.logUser}>{log.user}</Text>
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

function DocGenButton({ label, url }: any) {
  if (!url) {
    return (
      <View style={[styles.docBtn, styles.docBtnPending]}>
        <View style={[styles.docBtnIcon, styles.docBtnIconPending]}>
          <FileText size={16} color={theme.colors.textTertiary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docBtnLabel}>{label}</Text>
          <Text style={[styles.docBtnSub, { color: theme.colors.textTertiary }]}>Генерируется автоматически</Text>
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url)} style={[styles.docBtn, styles.docBtnReady]} activeOpacity={0.8}>
      <View style={[styles.docBtnIcon, { backgroundColor: theme.colors.profit + "20", borderColor: theme.colors.profit + "60" }]}>
        <ExternalLink size={16} color={theme.colors.profit} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docBtnLabel}>{label}</Text>
        <Text style={[styles.docBtnSub, { color: theme.colors.profit }]}>Готов · нажмите чтобы открыть</Text>
      </View>
    </TouchableOpacity>
  );
}

function DocToggle({ label, value, onToggle, onText, offText, amount, paidDate, docDate, testID }: any) {
  const display = value ? (onText || 'Готово') : (offText || 'Ждём');
  const formattedPaidDate = paidDate ? paidDate.slice(0, 10).split('-').reverse().join('.') : null;
  const formattedDocDate = docDate ? docDate.slice(0, 10).split('-').reverse().join('.') : null;
  return (
    <TouchableOpacity testID={testID} onPress={onToggle} style={[styles.toggle, value && styles.toggleOn]} activeOpacity={0.7}>
      <View style={[styles.checkBox, value && { backgroundColor: theme.colors.profit, borderColor: theme.colors.profit }]}>
        {value && <Check size={12} color="#000" strokeWidth={3} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={[styles.toggleStatus, { color: value ? theme.colors.profit : theme.colors.textTertiary }]}>{display}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {!!amount && <Text style={styles.toggleAmt}>{amount}</Text>}
        {value && !!formattedPaidDate && (
          <Text style={styles.toggleDate}>оплачено {formattedPaidDate}</Text>
        )}
        {value && !!formattedDocDate && (
          <Text style={styles.toggleDate}>{formattedDocDate}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: theme.colors.accent, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.loss, marginTop: 16, padding: 12, borderRadius: 10 },
  overdueText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },

  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, marginBottom: 4 },
  sumLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 4 },
  sumValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.textPrimary },

  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.accent, marginTop: 16, marginBottom: 10 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  choice: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  choiceActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  choiceText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  choiceTextActive: { color: theme.colors.accent },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  toggleOn: { borderColor: theme.colors.profit + '40', backgroundColor: theme.colors.profit + '08' },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' },
  toggleStatus: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  toggleDate: { fontSize: 11, color: theme.colors.textTertiary },
  toggleAmt: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },

  logsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 13, paddingHorizontal: 14,
    backgroundColor: theme.colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border, marginTop: 16,
  },
  logsBtnText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },

  saveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: theme.colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  emptyLogs: { textAlign: 'center', color: theme.colors.textTertiary, paddingVertical: 32, fontSize: 14 },
  logRow: {
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  logDate: { fontSize: 11, color: theme.colors.textTertiary, marginBottom: 4 },
  logField: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  logValues: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  logOld: { flex: 1, fontSize: 12, color: theme.colors.loss, fontWeight: '500' },
  logArrow: { fontSize: 12, color: theme.colors.textTertiary },
  logNew: { flex: 1, fontSize: 12, color: theme.colors.profit, fontWeight: '500' },
  logUser: { fontSize: 11, color: theme.colors.textTertiary },

  calBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.accent + '50', marginBottom: 8, marginTop: 4 },
  calBtnText: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' },

  docBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: theme.colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8,
  },
  docBtnReady: { borderColor: theme.colors.profit + '50', backgroundColor: theme.colors.profit + '08' },
  docBtnPending: { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, opacity: 0.7 },
  docBtnIconPending: { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
  docBtnIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: theme.colors.accent + '15', borderWidth: 1, borderColor: theme.colors.accent + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  docBtnLabel: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' },
  docBtnSub: { fontSize: 11, marginTop: 2 },
  docBtnRegen: { padding: 8 },
  entityLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 2, marginTop: -4, marginBottom: 8 },
  entityLinkText: { color: theme.colors.accent, fontSize: 12, fontWeight: '600' },
  createdAtRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    marginBottom: 10,
  },
  createdAtLabel: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '500' },
  createdAtValue: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600' },
});
