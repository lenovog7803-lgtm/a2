import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';

export default function NewClient() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>({
    name: '', contact_person: '', phone: '', email: '', inn: '', kpp: '',
    legal_address: '', bank_name: '', bank_account: '', bank_bik: '', bank_corr_account: '',
    payment_terms: '', cargo_types: '', directions: '', notes: '',
  });

  const update = (patch: any) => setData({ ...data, ...patch });

  const save = async () => {
    if (!data.name) { Alert.alert('Заполните', 'Название обязательно'); return; }
    setSaving(true);
    try {
      await api.clients.create(data);
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
        <Text style={styles.topTitle}>Новый клиент</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 100 }}>
        <Field label="Название компании" value={data.name} onChangeText={(v: string) => update({ name: v })} testID="new-client-name" />
        <Field label="Контактное лицо" value={data.contact_person} onChangeText={(v: string) => update({ contact_person: v })} />
        <Field label="Телефон" keyboardType="phone-pad" value={data.phone} onChangeText={(v: string) => update({ phone: v })} />
        <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={data.email} onChangeText={(v: string) => update({ email: v })} />
        <Field label="ИНН" keyboardType="numeric" value={data.inn} onChangeText={(v: string) => update({ inn: v })} />
        <Field label="КПП" keyboardType="numeric" value={data.kpp} onChangeText={(v: string) => update({ kpp: v })} />
        <Field label="Юр. адрес" multiline value={data.legal_address} onChangeText={(v: string) => update({ legal_address: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />

        <Text style={styles.groupLabel}>БАНК</Text>
        <Field label="Название банка" value={data.bank_name} onChangeText={(v: string) => update({ bank_name: v })} />
        <Field label="Расчётный счёт" keyboardType="numeric" value={data.bank_account} onChangeText={(v: string) => update({ bank_account: v })} />
        <Field label="БИК" keyboardType="numeric" value={data.bank_bik} onChangeText={(v: string) => update({ bank_bik: v })} />
        <Field label="Корр. счёт" keyboardType="numeric" value={data.bank_corr_account} onChangeText={(v: string) => update({ bank_corr_account: v })} />

        <Text style={styles.groupLabel}>ДОП ИНФО</Text>
        <Field label="Условия оплаты" placeholder="напр. 7 дней" value={data.payment_terms} onChangeText={(v: string) => update({ payment_terms: v })} />
        <Field label="Что возят" multiline value={data.cargo_types} onChangeText={(v: string) => update({ cargo_types: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Направления" multiline value={data.directions} onChangeText={(v: string) => update({ directions: v })} style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Field label="Заметки" multiline value={data.notes} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

        <TouchableOpacity testID="create-client-submit" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Добавить клиента</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700' },
  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.accent, marginTop: 16, marginBottom: 8 },
});
