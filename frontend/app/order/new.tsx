import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { Picker } from '../../src/components/Picker';
import { DateField } from '../../src/components/DateField';

export default function NewOrder() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>({
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
  });

  useEffect(() => {
    (async () => {
      const [c, cr, nn] = await Promise.all([
        api.clients.list(),
        api.carriers.list(),
        api.orders.nextNumber().catch(() => null),
      ]);
      setClients(c); setCarriers(cr);
      if (nn?.next_number) {
        setData((d: any) => ({ ...d, order_number: nn.next_number }));
      }
    })();
  }, []);

  const update = (patch: any) => setData({ ...data, ...patch });

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
    try { await api.orders.create(data); router.back(); }
    catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setSaving(false); }
  };

  const clientItems = clients.map(c => ({ id: c.id, label: c.name, sublabel: c.contact_person || c.phone }));
  const carrierItems = carriers.map(c => ({ id: c.id, label: c.company_name, sublabel: `${c.driver_name || ''} · ${c.plate || ''}` }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Новая заявка</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 100 }}>
        <Field label="Номер заявки" value={data.order_number} onChangeText={(v: string) => update({ order_number: v })} testID="new-order-number" />

        <Picker label="Клиент" value={data.client_id} items={clientItems} onSelect={selectClient} placeholder="Выбрать клиента…" testID="picker-client-new" />
        <Picker label="Перевозчик" value={data.carrier_id} items={carrierItems} onSelect={selectCarrier} placeholder="Выбрать перевозчика…" testID="picker-carrier-new" />

        <Text style={styles.groupLabel}>МАРШРУТ</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Откуда (город)" value={data.route_from} onChangeText={(v: string) => update({ route_from: v })} testID="new-from" /></View>
          <View style={{ flex: 1 }}><Field label="Куда (город)" value={data.route_to} onChangeText={(v: string) => update({ route_to: v })} testID="new-to" /></View>
        </View>
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
