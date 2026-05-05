import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Modal, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Trash2, Phone } from 'lucide-react-native';
import { theme, leadStatusLabels } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { DateField } from '../../src/components/DateField';

const STATUSES = ['new', 'in_progress', 'callback', 'won', 'lost'];

export default function LeadDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  useEffect(() => {
    const fetchWithRetry = async (attempts = 3) => { try { const data = await api.leads.get(id!); if (data) { setLead(data); setLoading(false); } else if (attempts > 1) { setTimeout(() => fetchWithRetry(attempts - 1), 500); } else { setLoading(false); } } catch { if (attempts > 1) setTimeout(() => fetchWithRetry(attempts - 1), 500); else setLoading(false); } }; fetchWithRetry();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.leads.update(id!, lead);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (typeof window !== 'undefined') {
      if (!window.confirm(`Удалить контакт ${lead?.name}?`)) return;
      try {
        await api.leads.delete(id!);
        router.back();
      } catch (e: any) {
        Alert.alert('Ошибка', e.message);
      }
    }
  };

  const update = (patch: any) => setLead((prev: any) => ({ ...prev, ...patch }));

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );

  if (!lead) return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.colors.textSecondary }}>Контакт не найден</Text>
    </View>
  );

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{lead.name}</Text>
          <TouchableOpacity onPress={remove} style={styles.iconBtn}>
            <Trash2 size={18} color={theme.colors.loss} strokeWidth={1.6} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 100 }}>
          <Field label="Имя" value={lead.name} onChangeText={(v: string) => update({ name: v })} />
          <Field label="Компания" value={lead.company} onChangeText={(v: string) => update({ company: v })} />
          <Field label="Телефон" keyboardType="phone-pad" value={lead.phone} onChangeText={(v: string) => update({ phone: v })} />
          <Field label="Город" value={lead.city} onChangeText={(v: string) => update({ city: v })} />
          <Field label="Направления" placeholder="МСК-СПб, МСК-НСК" value={lead.directions || ''} onChangeText={(v: string) => update({ directions: v })} />
          <Field label="Дата следующего звонка" placeholder="2026-02-15" value={lead.next_call || ''} onChangeText={(v: string) => update({ next_call: v })} />
          <Field label="Последний контакт" placeholder="2026-02-10" value={lead.last_contact || ''} onChangeText={(v: string) => update({ last_contact: v })} />

          <Text style={styles.label}>СТАТУС</Text>
          <View style={styles.row}>
            {STATUSES.map(s => (
              <TouchableOpacity key={s} onPress={() => update({ status: s })} style={[styles.pill, lead.status === s && styles.pillActive]} activeOpacity={0.7}>
                <Text style={[styles.pillText, lead.status === s && styles.pillTextActive]}>{leadStatusLabels[s] || s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Заметки" multiline value={lead.notes || ''} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

          {!!lead.phone && (
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${lead.phone}`)} activeOpacity={0.7}>
              <Phone size={16} color="#000" strokeWidth={2} />
              <Text style={styles.callBtnText}>Позвонить {lead.phone}</Text>
            </TouchableOpacity>
          )}

          {lead.status !== 'won' && (
            <TouchableOpacity style={styles.clientBtn} onPress={() => setShowClientModal(true)} activeOpacity={0.8}>
              <Text style={styles.clientBtnText}>Стал клиентом →</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Сохранить</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <ClientModal
        visible={showClientModal}
        lead={lead}
        onClose={() => setShowClientModal(false)}
        onSuccess={() => {
          setShowClientModal(false);
          update({ status: 'won' });
        }}
      />
    </>
  );
}

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

          <Field label="Контактное лицо" value={data.contact_person} onChangeText={(v: string) => upd({ contact_person: v })} />
          <Field label="Телефон" keyboardType="phone-pad" value={data.phone} onChangeText={(v: string) => upd({ phone: v })} />
          <Field label="Email" keyboardType="email-address" value={data.email} onChangeText={(v: string) => upd({ email: v })} />
          <Field label="Юридический адрес" value={data.legal_address} onChangeText={(v: string) => upd({ legal_address: v })} />
          <Field label="ИНН / УНП" value={data.inn} onChangeText={(v: string) => upd({ inn: v })} />
          <Field label="Банк" value={data.bank_name} onChangeText={(v: string) => upd({ bank_name: v })} />
          <Field label="Расчётный счёт" value={data.bank_account} onChangeText={(v: string) => upd({ bank_account: v })} />
          <Field label="БИК" value={data.bank_bik} onChangeText={(v: string) => upd({ bank_bik: v })} />

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
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 8, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  pillActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  pillText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: theme.colors.accent },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.accent, paddingVertical: 14, borderRadius: 12, justifyContent: 'center', marginBottom: 10 },
  callBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  clientBtn: { backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  clientBtnText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  saveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700' },
  clientHint: { backgroundColor: theme.colors.surfaceElevated, borderRadius: 10, padding: 12, marginBottom: 16 },
  clientHintText: { color: theme.colors.textSecondary, fontSize: 13 },
});
