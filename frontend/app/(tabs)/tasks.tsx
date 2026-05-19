import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, X, Search } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import InstructionsTab from '../../src/components/InstructionsTab';

const TASK_TYPES: Record<string, { label: string; emoji: string }> = {
  call:    { label: 'Звонок',     emoji: '📞' },
  meeting: { label: 'Встреча',    emoji: '🤝' },
  docs:    { label: 'Документы',  emoji: '📄' },
  order:   { label: 'Заявка',     emoji: '📦' },
  other:   { label: 'Другое',     emoji: '✏️' },
};

const TODAY = new Date().toISOString().slice(0, 10);

function overdueDays(due: string): number {
  return Math.floor((new Date(TODAY).getTime() - new Date(due).getTime()) / 86400000);
}

export default function Tasks() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<'tasks' | 'notes' | 'instructions'>('tasks');
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [savingEditNote, setSavingEditNote] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, n] = await Promise.all([api.tasks.list(), api.notes.list()]);
      setTasks(t);
      setNotes(n);
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

  const removeTask = (id: string) => {
    Alert.alert('Удалить задачу?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        const prev = tasks;
        setTasks(ts => ts.filter(t => t.id !== id));
        try {
          await api.tasks.delete(id);
        } catch (e: any) {
          setTasks(prev);
          Alert.alert('Ошибка', e.message);
        }
      }},
    ]);
  };

  const removeNote = (id: string) => {
    Alert.alert('Удалить заметку?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        const prev = notes;
        setNotes(ns => ns.filter(n => n.id !== id));
        try {
          await api.notes.delete(id);
        } catch (e: any) {
          setNotes(prev);
          Alert.alert('Ошибка', e.message);
        }
      }},
    ]);
  };

  const saveNote = async () => {
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    try {
      const created = await api.notes.create({ title: noteTitle.trim(), text: noteText.trim() });
      setNotes(ns => [created, ...ns]);
      setNoteTitle('');
      setNoteText('');
      setShowAddNote(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const saveEditNote = async () => {
    if (!editTitle.trim() || !selectedNote) return;
    setSavingEditNote(true);
    try {
      const updated = await api.notes.update(selectedNote.id, { title: editTitle.trim(), text: editText.trim() });
      setNotes(ns => ns.map(n => n.id === selectedNote.id ? updated : n));
      setSelectedNote(null);
      setEditingNote(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSavingEditNote(false);
    }
  };

  const deleteSelectedNote = () => {
    Alert.alert('Удалить заметку?', selectedNote?.title || '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        const id = selectedNote.id;
        setSelectedNote(null);
        setEditingNote(false);
        setNotes(ns => ns.filter(n => n.id !== id));
        await api.notes.delete(id).catch(() => {});
      }},
    ]);
  };

  const q = searchQuery.trim().toLowerCase();

  const filteredTasks = tasks.filter(t => {
    if (q && !((t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))) return false;
    if (filter === 'today')    return t.due_date === TODAY && t.status !== 'done';
    if (filter === 'upcoming') return t.due_date > TODAY && t.status !== 'done';
    if (filter === 'done')     return t.status === 'done';
    return true;
  });

  const filteredNotes = notes.filter(n =>
    !q || (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q)
  );

  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < TODAY && t.status !== 'done');

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

  const overdueHeader = overdueTasks.length > 0 ? (
    <View style={styles.overdueBlock}>
      <Text style={styles.overdueTitle}>⚠ Просроченные задачи</Text>
      <Text style={styles.overdueSub}>Требуют немедленного внимания — {overdueTasks.length} {overdueTasks.length === 1 ? 'задача' : overdueTasks.length < 5 ? 'задачи' : 'задач'}</Text>
      {overdueTasks.map(t => (
        <TouchableOpacity key={t.id} onPress={() => router.push(`/task/${t.id}` as any)} activeOpacity={0.85} style={styles.overdueCard}>
          <Text style={styles.overdueTaskTitle} numberOfLines={2}>{t.title}</Text>
          {!!t.description && <Text style={styles.overdueDesc} numberOfLines={1}>{t.description}</Text>}
          <View style={styles.overdueMeta}>
            <Text style={styles.overdueDue}>Дедлайн: {t.due_date}</Text>
            <Text style={styles.overdueBy}>Просрочено на {overdueDays(t.due_date)} дн.</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top + 16 }}>
      <View style={styles.headerWrap}>
        <View>
          <Text style={styles.kicker}>ПЛАНИРОВАНИЕ</Text>
          <Text style={styles.title}>{mode === 'tasks' ? 'Задачи' : mode === 'notes' ? 'Заметки' : 'Инструкции'}</Text>
        </View>
        {mode !== 'instructions' && (
          <TouchableOpacity
            onPress={() => mode === 'tasks' ? router.push('/task/new') : setShowAddNote(true)}
            style={styles.fab}
            activeOpacity={0.8}
          >
            <Plus size={20} color="#000" strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.modeToggle}>
        <TouchableOpacity onPress={() => setMode('tasks')} style={[styles.modeBtn, mode === 'tasks' && styles.modeBtnActive]} activeOpacity={0.7}>
          <Text style={[styles.modeBtnText, mode === 'tasks' && styles.modeBtnTextActive]}>Задачи</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('notes')} style={[styles.modeBtn, mode === 'notes' && styles.modeBtnActive]} activeOpacity={0.7}>
          <Text style={[styles.modeBtnText, mode === 'notes' && styles.modeBtnTextActive]}>Заметки</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('instructions')} style={[styles.modeBtn, mode === 'instructions' && styles.modeBtnActive]} activeOpacity={0.7}>
          <Text style={[styles.modeBtnText, mode === 'instructions' && styles.modeBtnTextActive]}>Инструкции</Text>
        </TouchableOpacity>
      </View>

      {mode === 'instructions' ? (
        <InstructionsTab />
      ) : (
        <>
          <View style={styles.searchBox}>
            <Search size={15} color={theme.colors.textTertiary} strokeWidth={1.6} />
            <TextInput
              style={styles.searchInput}
              placeholder={mode === 'tasks' ? 'Поиск по задачам...' : 'Поиск по заметкам...'}
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          {mode === 'tasks' && (
            <View style={styles.filtersRow}>
              {FILTERS.map(f => {
                const active = filter === f.id;
                const count = counts[f.id as keyof typeof counts];
                return (
                  <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.7}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                    {count > 0 && <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : mode === 'tasks' ? (
            <FlatList
              data={filteredTasks}
              keyExtractor={t => t.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListHeaderComponent={overdueHeader}
              ListEmptyComponent={overdueTasks.length === 0 ? <Text style={styles.empty}>Нет задач</Text> : null}
              renderItem={({ item }) => (
                <TaskCard
                  task={item}
                  onPress={() => router.push(`/task/${item.id}` as any)}
                  onDone={() => markDone(item.id)}
                  onDelete={() => removeTask(item.id)}
                />
              )}
            />
          ) : (
            <FlatList
              data={filteredNotes}
              keyExtractor={n => n.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListEmptyComponent={<Text style={styles.empty}>Нет заметок. Нажмите + чтобы добавить.</Text>}
              renderItem={({ item }) => (
                <NoteCard note={item} onPress={() => setSelectedNote(item)} onDelete={() => removeNote(item.id)} />
              )}
            />
          )}
        </>
      )}

      {/* Note detail modal */}
      <Modal visible={!!selectedNote} transparent animationType="slide" onRequestClose={() => { setSelectedNote(null); setEditingNote(false); }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setSelectedNote(null); setEditingNote(false); }} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24), maxHeight: '85%' }]}>
            {editingNote ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Редактировать</Text>
                  <TouchableOpacity onPress={() => setEditingNote(false)} style={{ padding: 4 }}>
                    <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.noteField} value={editTitle} onChangeText={setEditTitle} placeholder="Заголовок *" placeholderTextColor={theme.colors.textTertiary} autoFocus />
                <TextInput style={[styles.noteField, styles.noteFieldMulti]} value={editText} onChangeText={setEditText} placeholder="Текст заметки..." placeholderTextColor={theme.colors.textTertiary} multiline />
                <TouchableOpacity onPress={saveEditNote} disabled={savingEditNote || !editTitle.trim()} style={[styles.saveNoteBtn, (!editTitle.trim() || savingEditNote) && { opacity: 0.5 }]} activeOpacity={0.8}>
                  {savingEditNote ? <ActivityIndicator color="#000" /> : <Text style={styles.saveNoteBtnText}>Сохранить</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { flex: 1, paddingRight: 8 }]} numberOfLines={2}>{selectedNote?.title}</Text>
                  <TouchableOpacity onPress={() => { setSelectedNote(null); setEditingNote(false); }} style={{ padding: 4 }}>
                    <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: theme.colors.textTertiary, fontSize: 11, marginBottom: 14 }}>
                  {selectedNote?.created_at ? new Date(selectedNote.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
                <ScrollView style={{ flex: 1, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 }}>{selectedNote?.text || ''}</Text>
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => { setEditTitle(selectedNote.title); setEditText(selectedNote.text || ''); setEditingNote(true); }} style={[styles.saveNoteBtn, { flex: 1, backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border }]} activeOpacity={0.8}>
                    <Text style={[styles.saveNoteBtnText, { color: theme.colors.textPrimary }]}>Редактировать</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={deleteSelectedNote} style={[styles.saveNoteBtn, { flex: 1, backgroundColor: theme.colors.loss + '15', borderWidth: 1, borderColor: theme.colors.loss + '40' }]} activeOpacity={0.8}>
                    <Text style={[styles.saveNoteBtnText, { color: theme.colors.loss }]}>Удалить</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showAddNote} transparent animationType="slide" onRequestClose={() => setShowAddNote(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAddNote(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новая заметка</Text>
              <TouchableOpacity onPress={() => setShowAddNote(false)} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.noteField} placeholder="Заголовок *" placeholderTextColor={theme.colors.textTertiary} value={noteTitle} onChangeText={setNoteTitle} autoFocus />
            <TextInput style={[styles.noteField, styles.noteFieldMulti]} placeholder="Текст заметки..." placeholderTextColor={theme.colors.textTertiary} value={noteText} onChangeText={setNoteText} multiline />
            <TouchableOpacity onPress={saveNote} disabled={savingNote || !noteTitle.trim()} style={[styles.saveNoteBtn, (!noteTitle.trim() || savingNote) && { opacity: 0.5 }]} activeOpacity={0.8}>
              {savingNote ? <ActivityIndicator color="#000" /> : <Text style={styles.saveNoteBtnText}>Сохранить заметку</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NoteCard({ note, onPress, onDelete }: { note: any; onPress: () => void; onDelete: () => void }) {
  const date = note.created_at ? new Date(note.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.noteCard}>
      <View style={styles.noteCardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.noteTitle} numberOfLines={2}>{note.title}</Text>
          <Text style={styles.noteDate}>{date}</Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }} activeOpacity={0.7}>
          <X size={15} color={theme.colors.textTertiary} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>
      {!!note.text && <Text style={styles.noteText} numberOfLines={3}>{note.text}</Text>}
    </TouchableOpacity>
  );
}

function TaskCard({ task, onPress, onDone, onDelete }: { task: any; onPress: () => void; onDone: () => void; onDelete: () => void }) {
  const typeInfo = TASK_TYPES[task.task_type] || TASK_TYPES.other;
  const isDone = task.status === 'done';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.card, isDone && styles.cardDone]}>
      <View style={styles.cardMain}>
        <View style={styles.emojiWrap}>
          <Text style={styles.emoji}>{typeInfo.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>{task.title}</Text>
          {!!task.description && <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>}
          <View style={styles.metaRow}>
            <Text style={styles.typeBadge}>{typeInfo.label}</Text>
            {!!task.due_date && (
              <Text style={[styles.dueBadge, isDone && { color: theme.colors.textTertiary }]}>
                {task.due_date}{task.due_time ? ` · ${task.due_time}` : ''}
              </Text>
            )}
          </View>
        </View>
        <View style={[styles.statusDot, isDone && styles.statusDotDone]} />
      </View>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },

  modeToggle: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  modeBtnActive: { backgroundColor: theme.colors.surface },
  modeBtnText: { color: theme.colors.textTertiary, fontSize: 11, fontWeight: '600' },
  modeBtnTextActive: { color: theme.colors.textPrimary, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },

  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999 },
  chipActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: theme.colors.accent },
  chipCount: { color: theme.colors.textTertiary, fontSize: 11, fontWeight: '700', backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  chipCountActive: { color: theme.colors.accent, backgroundColor: theme.colors.accent + '20' },

  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  // Overdue block
  overdueBlock: { marginBottom: 20 },
  overdueTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.loss, marginBottom: 4 },
  overdueSub: { fontSize: 12, color: theme.colors.textTertiary, marginBottom: 10 },
  overdueCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.loss + '40',
    borderLeftWidth: 3, borderLeftColor: theme.colors.loss,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  overdueTaskTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  overdueDesc: { color: theme.colors.textTertiary, fontSize: 12, marginBottom: 4 },
  overdueMeta: { flexDirection: 'row', gap: 10 },
  overdueDue: { color: theme.colors.loss, fontSize: 11, fontWeight: '600' },
  overdueBy: { color: theme.colors.loss, fontSize: 11 },

  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14 },
  cardDone: { opacity: 0.65 },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  emojiWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  taskTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  taskTitleDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  taskDesc: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  typeBadge: { fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary, backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, letterSpacing: 0.5 },
  dueBadge: { fontSize: 11, color: theme.colors.accent, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.warning, marginTop: 4 },
  statusDotDone: { backgroundColor: theme.colors.profit },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  doneBtn: { flex: 1, backgroundColor: theme.colors.accent, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  doneBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, alignItems: 'center' },
  deleteBtnText: { color: theme.colors.loss, fontSize: 13, fontWeight: '600' },

  noteCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14 },
  noteCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  noteTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  noteDate: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 3 },
  noteText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: '700' },
  noteField: { backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 10 },
  noteFieldMulti: { minHeight: 90, textAlignVertical: 'top' },
  saveNoteBtn: { backgroundColor: theme.colors.accent, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  saveNoteBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
