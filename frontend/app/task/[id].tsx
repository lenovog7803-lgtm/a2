import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Trash2 } from 'lucide-react-native';
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

export default function EditTask() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    task_type: 'call',
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    status: 'pending',
  });

  useEffect(() => {
    (async () => {
      try {
        const task = await api.tasks.get(id!);
        setData({
          task_type: task.task_type || 'call',
          title: task.title || '',
          description: task.description || '',
          due_date: task.due_date || '',
          due_time: task.due_time || '',
          status: task.status || 'pending',
        });
      } catch (e: any) {
        Alert.alert('Задача не найдена', e.message);
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const update = (patch: Partial<typeof data>) => setData(d => ({ ...d, ...patch }));

  const save = async () => {
    if (!data.title.trim()) { Alert.alert('Заполните название задачи'); return; }
    setSaving(true);
    try {
      await api.tasks.update(id!, data);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Удалить задачу?', data.title || '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await api.tasks.delete(id!);
          router.back();
        } catch (e: any) {
          Alert.alert('Ошибка', e.message);
        }
      }},
    ]);
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.colors.bg }]}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Редактировать задачу</Text>
        <TouchableOpacity onPress={remove} style={styles.iconBtn}>
          <Trash2 size={18} color={theme.colors.loss} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 100 }}>
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

        <Text style={styles.sectionLabel}>СТАТУС</Text>
        <View style={styles.statusRow}>
          <TouchableOpacity
            onPress={() => update({ status: 'pending' })}
            style={[styles.statusBtn, data.status !== 'done' && styles.statusBtnPending]}
            activeOpacity={0.7}
          >
            <Text style={[styles.statusBtnText, data.status !== 'done' && styles.statusBtnTextPending]}>
              Не выполнено
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => update({ status: 'done' })}
            style={[styles.statusBtn, data.status === 'done' && styles.statusBtnDone]}
            activeOpacity={0.7}
          >
            <Text style={[styles.statusBtnText, data.status === 'done' && styles.statusBtnTextDone]}>
              ✓ Выполнено
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>Сохранить</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  typeBtnActive: { backgroundColor: theme.colors.accent + '18', borderColor: theme.colors.accent },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center' },
  typeLabelActive: { color: theme.colors.accent },

  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statusBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  statusBtnPending: { borderColor: theme.colors.warning, backgroundColor: theme.colors.warning + '15' },
  statusBtnDone: { borderColor: theme.colors.profit, backgroundColor: theme.colors.profit + '15' },
  statusBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  statusBtnTextPending: { color: theme.colors.warning },
  statusBtnTextDone: { color: theme.colors.profit },

  saveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
