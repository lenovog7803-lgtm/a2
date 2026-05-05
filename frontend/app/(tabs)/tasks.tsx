import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

const TASK_TYPES: Record<string, { label: string; emoji: string }> = {
  call:    { label: 'Звонок',     emoji: '📞' },
  meeting: { label: 'Встреча',    emoji: '🤝' },
  docs:    { label: 'Документы',  emoji: '📄' },
  order:   { label: 'Заявка',     emoji: '📦' },
  other:   { label: 'Другое',     emoji: '✏️' },
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function Tasks() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const t = await api.tasks.list();
      setTasks(t);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markDone = async (id: string) => {
    const prev = tasks;
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: 'done' } : t));
    try {
      await api.tasks.update(id, { status: 'done' });
    } catch (e: any) {
      setTasks(prev);
      Alert.alert('Ошибка', e.message);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Удалить задачу?')) return;
    const prev = tasks;
    setTasks(ts => ts.filter(t => t.id !== id));
    try {
      await api.tasks.delete(id);
    } catch (e: any) {
      setTasks(prev);
      Alert.alert('Ошибка', e.message);
    }
  };

  const filtered = tasks.filter(t => {
    if (filter === 'today')    return t.due_date === TODAY && t.status !== 'done';
    if (filter === 'upcoming') return t.due_date > TODAY && t.status !== 'done';
    if (filter === 'done')     return t.status === 'done';
    return true;
  });

  const counts = {
    all:      tasks.length,
    today:    tasks.filter(t => t.due_date === TODAY && t.status !== 'done').length,
    upcoming: tasks.filter(t => t.due_date > TODAY && t.status !== 'done').length,
    done:     tasks.filter(t => t.status === 'done').length,
  };

  const FILTERS = [
    { id: 'all',      label: 'Все' },
    { id: 'today',    label: 'Сегодня' },
    { id: 'upcoming', label: 'Предстоящие' },
    { id: 'done',     label: 'Выполненные' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <View>
          <Text style={styles.kicker}>ПЛАНИРОВАНИЕ</Text>
          <Text style={styles.title}>Задачи</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/task/new')} style={styles.fab} activeOpacity={0.8}>
          <Plus size={20} color="#000" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        {FILTERS.map(f => {
          const active = filter === f.id;
          const count = counts[f.id as keyof typeof counts];
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              {count > 0 && (
                <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет задач</Text>}
          renderItem={({ item }) => (
            <TaskCard task={item} onDone={() => markDone(item.id)} onDelete={() => remove(item.id)} />
          )}
        />
      )}
    </View>
  );
}

function TaskCard({ task, onDone, onDelete }: { task: any; onDone: () => void; onDelete: () => void }) {
  const typeInfo = TASK_TYPES[task.task_type] || TASK_TYPES.other;
  const isDone = task.status === 'done';

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      <View style={styles.cardMain}>
        {/* Emoji icon */}
        <View style={styles.emojiWrap}>
          <Text style={styles.emoji}>{typeInfo.emoji}</Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {!!task.description && (
            <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.typeBadge}>{typeInfo.label}</Text>
            {!!task.due_date && (
              <Text style={[styles.dueBadge, isDone && { color: theme.colors.textTertiary }]}>
                {task.due_date}{task.due_time ? ` · ${task.due_time}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Status dot */}
        <View style={[styles.statusDot, isDone && styles.statusDotDone]} />
      </View>

      {/* Actions */}
      {!isDone && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={onDone} style={styles.doneBtn} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>✓ Выполнено</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} activeOpacity={0.8}>
            <Text style={styles.deleteBtnText}>Удалить</Text>
          </TouchableOpacity>
        </View>
      )}
      {isDone && (
        <TouchableOpacity onPress={onDelete} style={[styles.deleteBtn, { marginTop: 10 }]} activeOpacity={0.8}>
          <Text style={styles.deleteBtnText}>Удалить</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerWrap: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },

  filtersRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999,
  },
  chipActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: theme.colors.accent },
  chipCount: {
    color: theme.colors.textTertiary, fontSize: 11, fontWeight: '700',
    backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  chipCountActive: { color: theme.colors.accent, backgroundColor: theme.colors.accent + '20' },

  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, padding: 14,
  },
  cardDone: { opacity: 0.65 },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

  emojiWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 20 },

  taskTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  taskTitleDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  taskDesc: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 3 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  typeBadge: {
    fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary,
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    letterSpacing: 0.5,
  },
  dueBadge: { fontSize: 11, color: theme.colors.accent, fontWeight: '600' },

  statusDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: theme.colors.warning, marginTop: 4,
  },
  statusDotDone: { backgroundColor: theme.colors.profit },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  doneBtn: {
    flex: 1, backgroundColor: theme.colors.accent,
    paddingVertical: 9, borderRadius: 8, alignItems: 'center',
  },
  doneBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtnText: { color: theme.colors.loss, fontSize: 13, fontWeight: '600' },
});
