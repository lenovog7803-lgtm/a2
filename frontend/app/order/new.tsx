import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Picker } from '../../src/components/Picker';
import { DateField } from '../../src/components/DateField';
import { CityInput } from '../../src/components/CityInput';
import { FormField, FormSection } from '../../src/components/FormField';

const DRAFT_KEY = 'draft_order';

const EMPTY: any = {
  order_number: '',
  client_id: '', client_name: '', carrier_id: '', carrier_name: '',
  route_from: '', route_to: '', route_from_address: '', route_to_address: '',
  load_date: '', unload_date: '',
  driver_name: '', driver_phone: '', vehicle_type: '', vehicle_plate: '',
  client_rate: 0, carrier_rate: 0, carrier_payment_days: 20,
  status: 'new', client_paid: false, carrier_paid: false,
  docs_to_client_sent: false, docs_from_client_received: false,
  docs_to_carrier_sent: false, docs_from_carrier_received: false,
  cargo: '', weight_tons: 0, notes: '',
};

const TABS = [
  { label: 'Основное', key: 'main' },
  { label: 'Финансы', key: 'finance' },
  { label: 'Документы', key: 'docs' },
];

export default function NewOrder() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { duplicateFrom, editFrom } = useLocalSearchParams<{ duplicateFrom?: string; editFrom?: string }>();
  const isEditMode = !!editFrom;
  const [clients, setClients] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(EMPTY);
  const [activeTab, setActiveTab] = useState('main');
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [c, cr, nn] = await Promise.all([
        api.clients.list(),
        api.carriers.list(),
        api.orders.getNextNumber().catch(() => null),
      ]);
      console.log('[NewOrder] getNextNumber response:', nn);
      setClients(c);
      setCarriers(cr);

      if (editFrom) {
        try {
          const source = await api.orders.get(editFrom);
          setData({ ...EMPTY, ...source });
        } catch (e: any) {
          Alert.alert('Ошибка', 'Не удалось загрузить заявку: ' + e.message);
        }
        return;
      }

      if (duplicateFrom) {
        try {
          const source = await api.orders.get(duplicateFrom);
          const { id: _id, order_number: _on, created_at: _ca, status: _st,
                  client_paid: _cp, carrier_paid: _cp2, client_paid_date: _cpd,
                  carrier_paid_date: _cpd2, calendar_event_id: _cei,
                  calendar_event_url: _ceu, doc_url_client: _duc,
                  doc_url_carrier: _duca, doc_url_act: _dua,
                  docs_to_client_sent: _dtcs, docs_from_client_received: _dfcr,
                  docs_to_carrier_sent: _dtcas, docs_from_carrier_received: _dfcar,
                  docs_to_client_date: _dtcd, docs_from_client_date: _dfcd,
                  docs_to_carrier_date: _dtcad, docs_from_carrier_date: _dfcad,
                  ...rest } = source;
          setData({
            ...EMPTY,
            ...rest,
            order_number: nn?.order_number != null ? String(nn.order_number) : '',
            status: 'new',
            client_paid: false,
            carrier_paid: false,
          });
        } catch {
          if (nn?.order_number) setData((d: any) => ({ ...d, order_number: nn.order_number }));
        }
        return;
      }

      const draft = await AsyncStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        Alert.alert(
          'Восстановить черновик?',
          'Найден несохранённый черновик заявки. Восстановить?',
          [
            { text: 'Нет', style: 'cancel', onPress: () => {
              if (nn?.order_number != null) setData((d: any) => ({ ...d, order_number: String(nn.order_number) }));
            }},
            { text: 'Восстановить', onPress: () => setData(parsed) },
          ],
        );
      } else if (nn?.order_number != null) {
        console.log('[NewOrder] setting order_number:', nn.order_number);
        setData((d: any) => ({ ...d, order_number: String(nn.order_number) }));
      }
    })();

    autoSaveRef.current = setInterval(async () => {
      if (isDirtyRef.current) {
        setData((current: any) => {
          AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(current)).catch(() => {});
          return current;
        });
        isDirtyRef.current = false;
      }
    }, 3000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  const update = (patch: any) => {
    isDirtyRef.current = true;
    setData((d: any) => ({ ...d, ...patch }));
  };

  const selectClient = (it: any) => update({ client_id: it.id, client_name: it.label });
  const selectCarrier = (it: any) => {
    const c = carriers.find(x => x.id === it.id);
    const parts = [c?.vehicle_type, c?.plate, c?.driver_name, c?.phone].filter(Boolean);
    update({
      carrier_id: it.id, carrier_name: it.label,
      driver_name: parts.length ? parts.join('\n') : data.driver_name,
    });
  };

  const save = async () => {
    if (!data.order_number || !data.route_from || !data.route_to) {
      Alert.alert('Заполните', 'Номер заявки и города маршрута обязательны');
      return;
    }
    setSaving(true);
    try {
      if (isEditMode && data.id) {
        await api.orders.update(data.id, data);
      } else {
        await api.orders.create(data);
        await AsyncStorage.removeItem(DRAFT_KEY);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  const clientItems = clients.map(c => ({ id: c.id, label: c.name, sublabel: c.contact_person || c.phone }));
  const carrierItems = carriers.map(c => ({ id: c.id, label: c.company_name, sublabel: `${c.driver_name || ''} · ${c.plate || ''}` }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 8, paddingBottom: 14, backgroundColor: theme.colors.surface, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.colors.border }}>
            <ArrowLeft size={16} color={theme.colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: -0.4 }}>
              {isEditMode ? 'Редактирование заявки' : duplicateFrom ? 'Дублирование заявки' : 'Создание новой заявки'}
            </Text>
            <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 }}>Заполните детали перевозки</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
              style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: activeTab === tab.key ? theme.colors.accent : theme.colors.bg, borderWidth: 0.5, borderColor: activeTab === tab.key ? theme.colors.accent : theme.colors.border }}
            >
              <Text style={{ fontSize: 12, fontWeight: activeTab === tab.key ? '600' : '400', color: activeTab === tab.key ? '#fff' : theme.colors.textSecondary }}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab: Основное */}
      {activeTab === 'main' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 100 }}>
          <FormSection title="ОСНОВНЫЕ ДАННЫЕ">
            <FormField label="Номер заявки" value={data.order_number} onChangeText={(v: string) => update({ order_number: v })} testID="new-order-number" placeholder="З-544/2026" />
            <Picker label="Клиент" value={data.client_id} items={clientItems} onSelect={selectClient} placeholder="Выбрать клиента…" testID="picker-client-new" />
            <Picker label="Перевозчик" value={data.carrier_id} items={carrierItems} onSelect={selectCarrier} placeholder="Выбрать перевозчика…" testID="picker-carrier-new" />
          </FormSection>

          <FormSection title="МАРШРУТ И ТОЧКИ">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <CityInput label="Откуда (город)" value={data.route_from} onChangeText={(v: string) => update({ route_from: v })} testID="new-from" />
              </View>
              <View style={{ flex: 1 }}>
                <CityInput label="Куда (город)" value={data.route_to} onChangeText={(v: string) => update({ route_to: v })} testID="new-to" />
              </View>
            </View>
            <FormField label="Адрес загрузки" multiline value={data.route_from_address} onChangeText={(v: string) => update({ route_from_address: v })} placeholder="Улица, дом, склад..." />
            <FormField label="Адрес выгрузки" multiline value={data.route_to_address} onChangeText={(v: string) => update({ route_to_address: v })} placeholder="Улица, дом, склад..." />
          </FormSection>

          <FormSection title="ГРАФИК">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <DateField label="Дата загрузки" value={data.load_date} onChange={(v: string) => update({ load_date: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="Дата выгрузки" value={data.unload_date} onChange={(v: string) => update({ unload_date: v })} />
              </View>
            </View>
          </FormSection>

          <FormSection title="ТРАНСПОРТ И ГРУЗ">
            <FormField label="Данные на ТС и водителя" multiline value={data.driver_name} onChangeText={(v: string) => update({ driver_name: v })} placeholder="Гос. номер, марка, ФИО, телефон..." />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <FormField label="Груз" value={data.cargo} onChangeText={(v: string) => update({ cargo: v })} placeholder="Описание груза" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Вес, т" keyboardType="numeric" value={String(data.weight_tons || '')} onChangeText={(v: string) => update({ weight_tons: parseFloat(v) || 0 })} placeholder="0.0" />
              </View>
            </View>
          </FormSection>

          <FormSection title="ПРИМЕЧАНИЯ">
            <FormField label="" multiline value={data.notes} onChangeText={(v: string) => update({ notes: v })} placeholder="Дополнительная информация по заказу..." />
          </FormSection>
        </ScrollView>
      )}

      {/* Tab: Финансы */}
      {activeTab === 'finance' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 100 }}>
          <FormSection title="ФИНАНСОВЫЕ УСЛОВИЯ">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FormField label="Ставка клиента, Br" keyboardType="numeric" value={String(data.client_rate || '')} onChangeText={(v: string) => update({ client_rate: parseFloat(v) || 0 })} placeholder="0.00" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Ставка перевозчика, Br" keyboardType="numeric" value={String(data.carrier_rate || '')} onChangeText={(v: string) => update({ carrier_rate: parseFloat(v) || 0 })} placeholder="0.00" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FormField label="Оплата (дней)" keyboardType="numeric" value={String(data.carrier_payment_days ?? 20)} onChangeText={(v: string) => update({ carrier_payment_days: parseInt(v) || 20 })} placeholder="20" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Тип груза" value={data.cargo} onChangeText={(v: string) => update({ cargo: v })} placeholder="Характеристики..." />
              </View>
            </View>
          </FormSection>

          {!!(data.client_rate && data.carrier_rate) && (
            <View style={{ backgroundColor: theme.colors.accent + '10', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: theme.colors.accent + '30' }}>
              <Text style={{ fontSize: 11, color: theme.colors.accent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Предварительная маржа</Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.accent, letterSpacing: -0.5 }}>
                {(data.client_rate - data.carrier_rate).toLocaleString('ru-RU')} Br
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>
                {(((data.client_rate - data.carrier_rate) / data.client_rate) * 100).toFixed(1)}% от ставки клиента
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Tab: Документы */}
      {activeTab === 'docs' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 100 }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: theme.colors.border }}>
            <Text style={{ fontSize: 13, color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 20 }}>
              Документы будут доступны после создания заявки
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Bottom bar */}
      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: theme.colors.surface, borderTopWidth: 0.5, borderTopColor: theme.colors.border, flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.colors.bg, alignItems: 'center', borderWidth: 0.5, borderColor: theme.colors.border }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary }}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="create-order-submit" onPress={save} disabled={saving}
          style={{ flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.colors.accent, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: theme.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, opacity: saving ? 0.6 : 1 }}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              {!isEditMode && <Plus size={16} color="#fff" strokeWidth={2.5} />}
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                {isEditMode ? 'Сохранить изменения' : 'Создать заявку →'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}
