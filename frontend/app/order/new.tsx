import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { Picker } from '../../src/components/Picker';
import { DateField } from '../../src/components/DateField';
import { CityInput } from '../../src/components/CityInput';

const DRAFT_KEY = 'draft_order';

const EMPTY: any = {
  order_number: '',
  client_id: '', client_name: '', carrier_id: '', carrier_name: '',
  route_from: '', route_to: '', route_from_address: '', route_to_address: '',
  load_date: '', unload_date: '',
  driver_name: '', driver_phone: '', vehicle_type: '', vehicle_plate: '',
  client_rate: 0, carrier_rate: 0,
  status: 'new', client_paid: false, carrier_paid: false,
  docs_to_client_sent: false, docs_from_client_received: false,
  docs_to_carrier_sent: false, docs_from_carrier_received: false,
  cargo: '', weight_tons: 0, notes: '',
};

export default function NewOrder() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { duplicateFrom } = useLocalSearchParams<{ duplicateFrom?: string }>();
  const [clients, setClients] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(EMPTY);
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

      // Check for draft
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

    // Auto-save every 3 seconds
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
      await api.orders.create(data);
      await AsyncStorage.removeItem(DRAFT_KEY);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false); }
  };

  const clientItems = clients.map(c => ({ id: c.id, label: c.name, sublabel: c.contact_person || c.phone }));
  const carrierItems = carriers.map(c => ({ id: c.id, label: c.company_name, sublabel: `${c.driver_name || ''} · ${c.plate || ''}` }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{duplicateFrom ? 'Дублирование заявки' : 'Новая заявка'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 100 }}>
        <Field label="Номер заявки" value={data.order_number} onChangeText={(v: string) => update({ order_number: v })} testID="new-order-number" />

        <Picker label="Клиент" value={data.client_id} items={clientItems} onSelect={selectClient} placeholder="Выбрать клиента…" testID="picker-client-new" />
        <Picker label="Перевозчик" value={data.carrier_id} items={carrierItems} onSelect={selectCarrier} placeholder="Выбрать перевозчика…" testID="picker-carrier-new" />

        <Text style={styles.groupLabel}>МАРШРУТ</Text>
        <CityInput label="Откуда (город)" value={data.route_from} onChangeText={(v: string) => update({ route_from: v })} testID="new-from" />
        <CityInput label="Куда (город)" value={data.route_to} onChangeText={(v: string) => update({ route_to: v })} testID="new-to" />
        <Field label="Точный адрес загрузки" multiline value={data.route_from_address} onChangeText={(v: string) => update({ route_from_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Точный адрес выгрузки" multiline value={data.route_to_address} onChangeText={(v: string) => update({ route_to_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><DateField label="Дата загр." value={data.load_date} onChange={(v: string) => update({ load_date: v })} /></View>
          <View style={{ flex: 1 }}><DateField label="Дата выгр." value={data.unload_date} onChange={(v: string) => update({ unload_date: v })} /></View>
        </View>

        <Text style={styles.groupLabel}>ДАННЫЕ ПО ВОДИТЕЛЮ И ТС</Text>
        <Field label="Данные на ТС" multiline value={data.driver_name} onChangeText={(v: string) => update({ driver_name: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

        <Text style={styles.groupLabel}>ГРУЗ И СТАВКИ</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Ставка клиента, Br" keyboardType="numeric" value={String(data.client_rate || '')} onChangeText={(v: string) => update({ client_rate: parseFloat(v) || 0 })} /></View>
          <View style={{ flex: 1 }}><Field label="Ставка перев., Br" keyboardType="numeric" value={String(data.carrier_rate || '')} onChangeText={(v: string) => update({ carrier_rate: parseFloat(v) || 0 })} /></View>
        </View>
        <Field label="Груз" value={data.cargo} onChangeText={(v: string) => update({ cargo: v })} />
        <Field label="Заметки" multiline value={data.notes} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 70, textAlignVertical: 'top' }} />

        <TouchableOpacity testID="create-order-submit" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Создать заявку</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.accent, marginTop: 12, marginBottom: 10 },
  saveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
