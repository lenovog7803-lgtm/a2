import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, ChevronDown, Check } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';

const BASIS_OPTIONS = [
  { id: 'устава', label: 'Устава' },
  { id: 'свидетельства', label: 'Свидетельства' },
];

const VEHICLES = ['Тент', 'Реф', 'Изотерм', 'Бортовой', 'Контейнер'];

export default function NewCarrier() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [basisOpen, setBasisOpen] = useState(false);
  const [data, setData] = useState<any>({
    company_name: '', driver_name: '', phone: '', inn: '', kpp: '',
    legal_address: '', postal_address: '', director: '', basis: '',
    bank_name: '', bank_account: '', bank_bik: '', bank_corr_account: '',
    vehicle_type: '', plate: '', capacity_tons: 0, capacity_m3: 0, rating: 5,
    cargo_types: '', regions: '', notes: '',
  });

  const update = (patch: any) => setData((prev: any) => ({ ...prev, ...patch }));

  const save = async () => {
    if (!data.company_name) { Alert.alert('Заполните', 'Название обязательно'); return; }
    setSaving(true);
    try {
      await api.carriers.create(data);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Новый перевозчик</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 100 }}>
        <Field label="Компания / ИП" value={data.company_name} onChangeText={(v: string) => update({ company_name: v })} testID="new-carrier-name" />
        <Field label="Водитель / контакт" value={data.driver_name} onChangeText={(v: string) => update({ driver_name: v })} />
        <Field label="Телефон" keyboardType="phone-pad" value={data.phone} onChangeText={(v: string) => update({ phone: v })} />

        <Text style={styles.groupLabel}>РЕКВИЗИТЫ</Text>
        <Field label="ИНН" keyboardType="numeric" value={data.inn} onChangeText={(v: string) => update({ inn: v })} />
        <Field label="КПП" keyboardType="numeric" value={data.kpp} onChangeText={(v: string) => update({ kpp: v })} />
        <Field label="Юр. адрес" multiline value={data.legal_address} onChangeText={(v: string) => update({ legal_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Почтовый адрес" multiline value={data.postal_address} onChangeText={(v: string) => update({ postal_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Директор" value={data.director} onChangeText={(v: string) => update({ director: v })} />

        <Text style={styles.fieldLabel}>ОСНОВАНИЕ</Text>
        <TouchableOpacity onPress={() => setBasisOpen(true)} activeOpacity={0.7} style={styles.dropdownBtn}>
          <Text style={[styles.dropdownValue, !data.basis && { color: theme.colors.textTertiary }]}>
            {BASIS_OPTIONS.find(o => o.id === data.basis)?.label || 'Выбрать…'}
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
                  const active = item.id === data.basis;
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
        <Field label="Название банка" value={data.bank_name} onChangeText={(v: string) => update({ bank_name: v })} />
        <Field label="Расчётный счёт" keyboardType="numeric" value={data.bank_account} onChangeText={(v: string) => update({ bank_account: v })} />
        <Field label="БИК" keyboardType="numeric" value={data.bank_bik} onChangeText={(v: string) => update({ bank_bik: v })} />
        <Field label="Корр. счёт" keyboardType="numeric" value={data.bank_corr_account} onChangeText={(v: string) => update({ bank_corr_account: v })} />

        <Text style={styles.groupLabel}>ТРАНСПОРТ</Text>
        <View style={styles.row}>
          {VEHICLES.map(v => (
            <TouchableOpacity key={v} onPress={() => update({ vehicle_type: v })} style={[styles.pill, data.vehicle_type === v && styles.pillActive]} activeOpacity={0.7}>
              <Text style={[styles.pillText, data.vehicle_type === v && styles.pillTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Field label="Тонн" keyboardType="numeric" value={String(data.capacity_tons || '')} onChangeText={(v: string) => update({ capacity_tons: parseFloat(v) || 0 })} /></View>
          <View style={{ flex: 1 }}><Field label="Объём, м³" keyboardType="numeric" value={String(data.capacity_m3 || '')} onChangeText={(v: string) => update({ capacity_m3: parseFloat(v) || 0 })} /></View>
        </View>
        <Field label="Гос. номер" autoCapitalize="characters" value={data.plate} onChangeText={(v: string) => update({ plate: v })} />

        <Text style={styles.groupLabel}>ДОП ИНФО</Text>
        <Field label="Что возят" multiline value={data.cargo_types} onChangeText={(v: string) => update({ cargo_types: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Регионы работы" multiline value={data.regions} onChangeText={(v: string) => update({ regions: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Заметки" multiline value={data.notes} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 70, textAlignVertical: 'top' }} />

        <TouchableOpacity testID="create-carrier-submit" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Добавить перевозчика</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 8, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  pillActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  pillText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: theme.colors.accent },
  saveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700' },
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
});
