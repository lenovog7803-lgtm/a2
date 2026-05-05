import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { DateField } from '../../src/components/DateField';

const TASK_TYPES = [
  { id: 'call',    label: 'Звонок',    emoji: '📞' },
  { id: 'meeting', label: 'Встреча',   emoji: '🤝' },
  { id: 'docs',    label: 'Документы', emoji: '📄' },
  { id: 'order',   label: 'Заявка',    emoji: '📦' },
  { id: 'other',   label: 'Другое',    emoji: '✏️' },
];

export default function NewTask() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    task_type: 'call',
    title: '',
    description: '',
    due_date: '',
    due_time: '',
  });

  const update = (patch: Partial<typeof data>) => setData(d => ({ ...d, ...patch }));

  const save = async () => {
    if (!data.title.trim()) {
      Alert.alert('Заполните название задачи');
      return;
    }
    setSaving(true);
    try {
      await api.tasks.create(data);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Новая задача</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 100 }}>
        {/* Type selector */}
        <Text style={styles.sectionLabel}>ТИП ЗАДАЧИ</Text>
        <View style={styles.typeRow}>
          {TASK_TYPES.map(t => {
            const active = data.task_type === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => update({ task_type: t.id })}
                style={[styles.typeBtn, active && styles.typeBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field
          label="Название"
          value={data.title}
          onChangeText={(v: string) => update({ title: v })}
          placeholder="Что нужно сделать?"
        />
        <Field
          label="Описание"
          multiline
          value={data.description}
          onChangeText={(v: string) => update({ description: v })}
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />

        <DateField
          label="Дата"
          value={data.due_date}
          onChange={(v: string) => update({ due_date: v })}
        />

        {/* Time input */}
        <Text style={styles.sectionLabel}>ВРЕМЯ</Text>
        {Platform.OS === 'web' ? (
          <input
            type="time"
            value={data.due_time}
            onChange={e => update({ due_time: e.target.value })}
            style={{
              backgroundColor: (theme.colors as any).surfaceElevated,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 10,
              padding: '12px 14px',
              color: theme.colors.textPrimary,
              fontSize: 15,
              width: '100%',
              boxSizing: 'border-box' as const,
              outline: 'none',
              marginBottom: 16,
            }}
          />
        ) : (
          <Field
            label=""
            placeholder="14:30"
            keyboardType="numbers-and-punctuation"
            value={data.due_time}
            onChangeText={(v: string) => update({ due_time: v })}
          />
        )}

        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.saveText}>Создать задачу</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: theme.colors.textTertiary, marginBottom: 10, marginTop: 4,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  typeBtn: {
    flex: 1, minWidth: 60,
    alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.accent + '18',
    borderColor: theme.colors.accent,
  },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center' },
  typeLabelActive: { color: theme.colors.accent },

  saveBtn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
  },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
