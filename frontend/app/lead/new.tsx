import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { theme, leadStatusLabels } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { DateField } from '../../src/components/DateField';

const DRAFT_KEY = 'draft_lead';
const STATUSES = ['new', 'in_progress', 'callback', 'won', 'lost'];

const EMPTY: any = {
  name: '', company: '', phone: '', email: '', city: '', industry: '', status: 'new',
  last_contact: '', next_call: '', notes: '', directions: '',
};

export default function NewLead() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(EMPTY);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    (async () => {
      const draft = await AsyncStorage.getItem(DRAFT_KEY);
      if (draft) {
        Alert.alert(
          'Восстановить черновик?',
          'Найден несохранённый черновик контакта. Восстановить?',
          [
            { text: 'Нет', style: 'cancel' },
            { text: 'Восстановить', onPress: () => setData(JSON.parse(draft)) },
          ],
        );
      }
    })();

    autoSaveRef.current = setInterval(() => {
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

  const save = async () => {
    if (!data.name || !data.phone) {
      Alert.alert('Заполните', 'Имя и телефон обязательны');
      return;
    }
    setSaving(true);
    try {
      await api.leads.create(data);
      await AsyncStorage.removeItem(DRAFT_KEY);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Новый контакт</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 100 }}>
        <Field label="Имя" value={data.name} onChangeText={(v: string) => update({ name: v })} testID="new-lead-name" />
        <Field label="Компания" value={data.company} onChangeText={(v: string) => update({ company: v })} />
        <Field label="Телефон" keyboardType="phone-pad" value={data.phone} onChangeText={(v: string) => update({ phone: v })} testID="new-lead-phone" />
        <Field label="Email" keyboardType="email-address" value={data.email} onChangeText={(v: string) => update({ email: v })} />
        <Field label="Город" value={data.city} onChangeText={(v: string) => update({ city: v })} />
        <DateField label="Дата следующего звонка" value={data.next_call} onChange={(v: string) => update({ next_call: v })} />

        <Text style={styles.label}>СТАТУС</Text>
        <View style={styles.row}>
          {STATUSES.map(s => (
            <TouchableOpacity key={s} onPress={() => update({ status: s })} style={[styles.pill, data.status === s && styles.pillActive]} activeOpacity={0.7}>
              <Text style={[styles.pillText, data.status === s && styles.pillTextActive]}>{leadStatusLabels[s]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field label="Отрасль" value={data.industry} onChangeText={(v: string) => update({ industry: v })} />
        <Field label="Направления" placeholder="МСК-СПб, МСК-НСК" value={data.directions} onChangeText={(v: string) => update({ directions: v })} />
        <Field label="Заметки" multiline value={data.notes} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

        <TouchableOpacity testID="create-lead-submit" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Добавить</Text>}
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  pillActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  pillText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: theme.colors.accent },
  saveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
