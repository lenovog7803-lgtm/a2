import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { theme } from '../theme';
import { api } from '../api';
import { Field } from './Field';

function ClientModal({ visible, lead, onClose, onSuccess }: any) {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>({});

  useEffect(() => {
    if (visible && lead) {
      setData({
        contact_person: lead.name || '',
        phone: lead.phone || '',
        email: '',
        legal_address: '',
        inn: '',
        bank_name: '',
        bank_account: '',
        bank_bik: '',
        postal_address: '',
        cargo_types: '',
        director: '',
        basis: 'Устав',
      });
    }
  }, [visible, lead]);

  const upd = (patch: any) => setData((prev: any) => ({ ...prev, ...patch }));

  const confirm = async () => {
    if (!lead.company) {
      Alert.alert('Укажите компанию', 'Заполните название компании в контакте');
      return;
    }
    setSaving(true);
    try {
      await api.clients.create({ name: lead.company, ...data });
      await api.leads.update(lead.id, { status: 'won' });
      onSuccess();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Добавить клиента</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 100 }}>
          <View style={styles.clientHint}>
            <Text style={styles.clientHintText}>Компания: <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>{lead?.company || '—'}</Text></Text>
          </View>

          <Field label="Сфера" value={data.cargo_types} onChangeText={(v: string) => upd({ cargo_types: v })} />
          <Field label="Контактное лицо" value={data.contact_person} onChangeText={(v: string) => upd({ contact_person: v })} />
          <Field label="Телефон" keyboardType="phone-pad" value={data.phone} onChangeText={(v: string) => upd({ phone: v })} />
          <Field label="Email" keyboardType="email-address" value={data.email} onChangeText={(v: string) => upd({ email: v })} />
          <Field label="Почтовый адрес" value={data.postal_address} onChangeText={(v: string) => upd({ postal_address: v })} />
          <Field label="Юридический адрес" value={data.legal_address} onChangeText={(v: string) => upd({ legal_address: v })} />
          <Field label="ИНН / УНП" value={data.inn} onChangeText={(v: string) => upd({ inn: v })} />
          <Field label="Банк" value={data.bank_name} onChangeText={(v: string) => upd({ bank_name: v })} />
          <Field label="Расчётный счёт" value={data.bank_account} onChangeText={(v: string) => upd({ bank_account: v })} />
          <Field label="БИК" value={data.bank_bik} onChangeText={(v: string) => upd({ bank_bik: v })} />
          <Field label="Директор" value={data.director} onChangeText={(v: string) => upd({ director: v })} />
          <Field label="Основание" value={data.basis} onChangeText={(v: string) => upd({ basis: v })} />

          <TouchableOpacity onPress={confirm} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Создать клиента</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  topTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clientHint: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 14, marginBottom: 20 },
  clientHintText: { fontSize: 14, color: theme.colors.textSecondary },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export { ClientModal };
