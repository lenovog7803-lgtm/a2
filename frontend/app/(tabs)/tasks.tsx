import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, X, Search, Phone, DollarSign, FileText, CheckSquare, Calendar, AlertTriangle } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import InstructionsTab from '../../src/components/InstructionsTab';

const TODAY = new Date().toISOString().slice(0, 10);

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  call:     { icon: Phone,       color: '#2563EB', bg: '#EFF6FF' },
  meeting:  { icon: Calendar,    color: '#2563EB', bg: '#EFF6FF' },
  docs:     { icon: FileText,    color: '#8B5CF6', bg: '#F5F3FF' },
  order:    { icon: CheckSquare, color: '#6B7280', bg: '#F9FAFB' },
  payment:  { icon: DollarSign,  color: '#10B981', bg: '#ECFDF5' },
  document: { icon: FileText,    color: '#8B5CF6', bg: '#F5F3FF' },
  other:    { icon: CheckSquare, color: '#6B7280', bg: '#F9FAFB' },
};

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
  const activeCalls = tasks.filter(t => t.task_type === 'call' && t.status !== 'done');

  const FILTERS = [
    { key: 'all',      label: 'Все',         count: tasks.length },
    { key: 'today',    label: 'Сегодня',      count: tasks.filter(t => t.due_date === TODAY && t.status !== 'done').length },
    { key: 'upcoming', label: 'Предстоящие',  count: tasks.filter(t => t.due_date > TODAY && t.status !== 'done').length },
    { key: 'done',     label: 'Выполненные',  count: tasks.filter(t => t.status === 'done').length },
  ];

  const overdueBanner = overdueTasks.length > 0 ? (
    <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <AlertTriangle size={16} color="#EF4444" strokeWidth={2} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}>Просроченные задачи</Text>
      <View style={{ backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto' as any }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{overdueTasks.length} задач</Text>
      </View>
    </View>
  ) : null;

  const callTasksSection = activeCalls.length > 0 ? (
    <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>Активные звонки</Text>
        <TouchableOpacity>
          <Text style={{ fontSize: 12, color: theme.colors.accent }}>По приоритету</Text>
        </TouchableOpacity>
      </View>
      {activeCalls.map((task: any) => (
        <TaskCard key={task.id} task={task} onPress={() => router.push(`/task/${task.id}` as any)} onComplete={() => markDone(task.id)} onDelete={() => removeTask(task.id)} />
      ))}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 8, paddingBottom: 14, backgroundColor: theme.colors.surface, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: -0.8 }}>
              {mode === 'tasks' ? 'Задачи' : mode === 'notes' ? 'Заметки' : 'Инструкции'}
            </Text>
            {mode === 'tasks' && <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 }}>Операционный контроль</Text>}
          </View>
          {mode !== 'instructions' && (
            <TouchableOpacity onPress={() => mode === 'tasks' ? router.push('/task/new' as any) : setShowAddNote(true)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            >
              <Plus size={18} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        {/* Mode toggle */}
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

        {/* Filter chips */}
        {mode === 'tasks' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {FILTERS.map((f) => (
                <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: filter === f.key ? theme.colors.accent : theme.colors.bg, borderWidth: 0.5, borderColor: filter === f.key ? theme.colors.accent : theme.colors.border }}
                >
                  <Text style={{ fontSize: 12, fontWeight: filter === f.key ? '600' : '400', color: filter === f.key ? '#fff' : theme.colors.textSecondary }}>{f.label}</Text>
                  <View style={{ backgroundColor: filter === f.key ? 'rgba(255,255,255,0.25)' : theme.colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: filter === f.key ? '#fff' : theme.colors.textTertiary }}>{f.count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
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

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : mode === 'tasks' ? (
            <FlatList
              data={filteredTasks}
              keyExtractor={t => t.id}
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
              renderItem={({ item }) => (
                <TaskCard
                  task={item}
                  onPress={() => router.push(`/task/${item.id}` as any)}
                  onComplete={() => markDone(item.id)}
                  onDelete={() => removeTask(item.id)}
                />
              )}
              ListHeaderComponent={
                <>
                  {overdueBanner}
                  {callTasksSection}
                  {filteredTasks.length > 0 && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
                      Все задачи
                    </Text>
                  )}
                </>
              }
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <CheckSquare size={48} color={theme.colors.textTertiary} strokeWidth={1} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 12 }}>Нет задач</Text>
                  <Text style={{ fontSize: 13, color: theme.colors.textTertiary, marginTop: 4 }}>Все задачи выполнены</Text>
                </View>
              }
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

function TaskCard({ task, onPress, onComplete, onDelete }: { task: any; onPress: () => void; onComplete: () => void; onDelete: () => void }) {
  const isOverdue = task.due_date && task.due_date < TODAY && task.status !== 'done';
  const isDone = task.status === 'done';
  const tc = typeConfig[task.task_type || 'other'] || typeConfig.other;
  const Icon = tc.icon;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78}
      style={{ backgroundColor: isOverdue ? '#FEF2F2' : theme.colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, marginHorizontal: 16, borderWidth: 0.5, borderColor: isOverdue ? '#FECACA' : theme.colors.border, opacity: isDone ? 0.6 : 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isOverdue ? '#FEE2E2' : tc.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color={isOverdue ? '#EF4444' : tc.color} strokeWidth={1.8} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: isOverdue ? '#EF4444' : theme.colors.textPrimary, textDecorationLine: isDone ? 'line-through' : 'none' }} numberOfLines={2}>
            {task.title}
          </Text>
          {!!task.related_name && (
            <Text style={{ fontSize: 11, color: theme.colors.accent, marginTop: 2 }} numberOfLines={1}>
              {task.related_type === 'lead' ? 'Лид: ' : 'Заявка: '}{task.related_name}
            </Text>
          )}
          {!!task.phone && (
            <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{task.phone}</Text>
          )}
          {!!task.due_date && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Calendar size={10} color={isOverdue ? '#EF4444' : theme.colors.textTertiary} strokeWidth={2} />
              <Text style={{ fontSize: 10, color: isOverdue ? '#EF4444' : theme.colors.textTertiary, fontWeight: isOverdue ? '600' : '400' }}>
                {isOverdue ? 'Просрочено: ' : 'Дедлайн: '}{new Date(task.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              {isOverdue && (
                <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '600' }}>
                  · на {Math.round((Date.now() - new Date(task.due_date).getTime()) / 86400000)} д.
                </Text>
              )}
            </View>
          )}
        </View>

        {!isDone && (
          <TouchableOpacity onPress={onComplete}
            style={{ backgroundColor: theme.colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>✓ Готово</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={onDelete} style={{ marginTop: 10, alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 0.5, borderColor: theme.colors.border }} activeOpacity={0.7}>
        <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>Удалить</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bg, borderRadius: 12, padding: 3,
    borderWidth: 0.5, borderColor: theme.colors.border,
  },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  modeBtnActive: { backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  modeBtnText: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: '500' },
  modeBtnTextActive: { color: theme.colors.textPrimary, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },

  noteCard: { backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border, borderRadius: 14, padding: 14 },
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
