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
  call:     { icon: Phone,       color: '#1366F0', bg: 'rgba(19,102,240,0.12)' },
  meeting:  { icon: Calendar,    color: '#1366F0', bg: 'rgba(19,102,240,0.12)' },
  docs:     { icon: FileText,    color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  order:    { icon: CheckSquare, color: '#5A6573', bg: 'rgba(14,23,38,0.06)' },
  payment:  { icon: DollarSign,  color: '#1E9E5A', bg: 'rgba(30,158,90,0.12)' },
  document: { icon: FileText,    color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  other:    { icon: CheckSquare, color: '#5A6573', bg: 'rgba(14,23,38,0.06)' },
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
    <View style={{ marginHorizontal: 14, marginTop: 10, marginBottom: 4, backgroundColor: 'rgba(224,71,59,0.08)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(224,71,59,0.2)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(224,71,59,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <AlertTriangle size={16} color="#E0473B" strokeWidth={2} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#E0473B', flex: 1 }}>Просроченные задачи</Text>
      <View style={{ backgroundColor: '#E0473B', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{overdueTasks.length}</Text>
      </View>
    </View>
  ) : null;

  const callTasksSection = activeCalls.length > 0 ? (
    <View style={{ paddingHorizontal: 14, marginTop: 8 }}>
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0E1726', letterSpacing: -0.2, marginBottom: 8 }}>Активные звонки</Text>
      {activeCalls.map((task: any) => (
        <TaskCard key={task.id} task={task} onPress={() => router.push(`/task/${task.id}` as any)} onComplete={() => markDone(task.id)} onDelete={() => removeTask(task.id)} />
      ))}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#EDEFF3' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14, backgroundColor: '#EDEFF3' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#0E1726', letterSpacing: -0.8 }}>
              {mode === 'tasks' ? 'Задачи' : mode === 'notes' ? 'Заметки' : 'Инструкции'}
            </Text>
            {mode === 'tasks' && (
              <Text style={{ fontSize: 12.5, color: '#8A93A0', marginTop: 2, fontWeight: '500' }}>
                Всего: <Text style={{ fontWeight: '700', color: '#0E1726' }}>{tasks.length}</Text>
              </Text>
            )}
          </View>
          {mode !== 'instructions' && (
            <TouchableOpacity onPress={() => mode === 'tasks' ? router.push('/task/new' as any) : setShowAddNote(true)} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0E1726', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 }}>
              <Plus size={15} color="#fff" strokeWidth={2.2} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Добавить</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          {(['tasks', 'notes', 'instructions'] as const).map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} activeOpacity={0.7}>
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'tasks' ? 'Задачи' : m === 'notes' ? 'Заметки' : 'Инструкции'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter chips */}
        {mode === 'tasks' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {FILTERS.map((f) => (
                <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11, backgroundColor: filter === f.key ? '#0E1726' : '#fff', borderWidth: 1, borderColor: filter === f.key ? 'transparent' : 'rgba(14,23,38,0.08)' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: filter === f.key ? '#fff' : '#5A6573' }}>{f.label}</Text>
                  <View style={{ backgroundColor: filter === f.key ? 'rgba(255,255,255,0.15)' : 'rgba(14,23,38,0.06)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: filter === f.key ? 'rgba(255,255,255,0.8)' : '#8A93A0' }}>{f.count}</Text>
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
            <Search size={15} color="#8A93A0" strokeWidth={1.6} />
            <TextInput
              style={styles.searchInput}
              placeholder={mode === 'tasks' ? 'Поиск по задачам...' : 'Поиск по заметкам...'}
              placeholderTextColor="#8A93A0"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#1366F0" />
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
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#8A93A0', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 14, marginTop: 14, marginBottom: 6 }}>
                      Все задачи · {filteredTasks.length}
                    </Text>
                  )}
                </>
              }
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <CheckSquare size={44} color="#8A93A0" strokeWidth={1.2} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#5A6573', marginTop: 12 }}>Нет задач</Text>
                  <Text style={{ fontSize: 13, color: '#8A93A0', marginTop: 4 }}>Все задачи выполнены</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={filteredNotes}
              keyExtractor={n => n.id}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 100 }}
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
                    <X size={20} color="#5A6573" strokeWidth={1.6} />
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.noteField} value={editTitle} onChangeText={setEditTitle} placeholder="Заголовок *" placeholderTextColor="#8A93A0" autoFocus />
                <TextInput style={[styles.noteField, styles.noteFieldMulti]} value={editText} onChangeText={setEditText} placeholder="Текст заметки..." placeholderTextColor="#8A93A0" multiline />
                <TouchableOpacity onPress={saveEditNote} disabled={savingEditNote || !editTitle.trim()} style={[styles.saveNoteBtn, (!editTitle.trim() || savingEditNote) && { opacity: 0.5 }]} activeOpacity={0.8}>
                  {savingEditNote ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveNoteBtnText}>Сохранить</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { flex: 1, paddingRight: 8 }]} numberOfLines={2}>{selectedNote?.title}</Text>
                  <TouchableOpacity onPress={() => { setSelectedNote(null); setEditingNote(false); }} style={{ padding: 4 }}>
                    <X size={20} color="#5A6573" strokeWidth={1.6} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: '#8A93A0', fontSize: 11, marginBottom: 14 }}>
                  {selectedNote?.created_at ? new Date(selectedNote.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
                <ScrollView style={{ flex: 1, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                  <Text style={{ color: '#5A6573', fontSize: 14, lineHeight: 22 }}>{selectedNote?.text || ''}</Text>
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => { setEditTitle(selectedNote.title); setEditText(selectedNote.text || ''); setEditingNote(true); }}
                    style={[styles.saveNoteBtn, { flex: 1, backgroundColor: 'rgba(14,23,38,0.06)', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)' }]} activeOpacity={0.8}>
                    <Text style={[styles.saveNoteBtnText, { color: '#0E1726' }]}>Редактировать</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={deleteSelectedNote}
                    style={[styles.saveNoteBtn, { flex: 1, backgroundColor: 'rgba(224,71,59,0.1)', borderWidth: 1, borderColor: 'rgba(224,71,59,0.25)' }]} activeOpacity={0.8}>
                    <Text style={[styles.saveNoteBtnText, { color: '#E0473B' }]}>Удалить</Text>
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
                <X size={20} color="#5A6573" strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.noteField} placeholder="Заголовок *" placeholderTextColor="#8A93A0" value={noteTitle} onChangeText={setNoteTitle} autoFocus />
            <TextInput style={[styles.noteField, styles.noteFieldMulti]} placeholder="Текст заметки..." placeholderTextColor="#8A93A0" value={noteText} onChangeText={setNoteText} multiline />
            <TouchableOpacity onPress={saveNote} disabled={savingNote || !noteTitle.trim()} style={[styles.saveNoteBtn, (!noteTitle.trim() || savingNote) && { opacity: 0.5 }]} activeOpacity={0.8}>
              {savingNote ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveNoteBtnText}>Сохранить заметку</Text>}
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.noteCard}>
      <View style={styles.noteCardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.noteTitle} numberOfLines={2}>{note.title}</Text>
          <Text style={styles.noteDate}>{date}</Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }} activeOpacity={0.7}>
          <X size={15} color="#8A93A0" strokeWidth={1.6} />
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}
      style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 8, marginHorizontal: 14, borderWidth: 1, borderColor: isOverdue ? 'rgba(224,71,59,0.2)' : 'rgba(14,23,38,0.07)', opacity: isDone ? 0.6 : 1, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: isOverdue ? 'rgba(224,71,59,0.12)' : tc.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color={isOverdue ? '#E0473B' : tc.color} strokeWidth={1.8} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: isOverdue ? '#E0473B' : '#0E1726', textDecorationLine: isDone ? 'line-through' : 'none', lineHeight: 20 }} numberOfLines={2}>
            {task.title}
          </Text>
          {!!task.related_name && (
            <Text style={{ fontSize: 12, color: '#1366F0', marginTop: 3, fontWeight: '500' }} numberOfLines={1}>
              {task.related_type === 'lead' ? 'Лид: ' : 'Заявка: '}{task.related_name}
            </Text>
          )}
          {!!task.phone && (
            <Text style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>{task.phone}</Text>
          )}
          {!!task.due_date && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: isOverdue ? 'rgba(224,71,59,0.08)' : 'rgba(14,23,38,0.05)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' }}>
              <Calendar size={11} color={isOverdue ? '#E0473B' : '#8A93A0'} strokeWidth={2} />
              <Text style={{ fontSize: 11, color: isOverdue ? '#E0473B' : '#8A93A0', fontWeight: isOverdue ? '600' : '500' }}>
                {isOverdue ? 'Просрочено ' : ''}{new Date(task.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </View>

        {!isDone && (
          <TouchableOpacity onPress={onComplete}
            style={{ backgroundColor: 'rgba(30,158,90,0.12)', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, flexShrink: 0 }}
            activeOpacity={0.8}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E9E5A' }}>✓</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={onDelete} style={{ marginTop: 12, alignSelf: 'flex-end', paddingHorizontal: 11, paddingVertical: 5, backgroundColor: 'rgba(14,23,38,0.04)', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(14,23,38,0.06)' }} activeOpacity={0.7}>
        <Text style={{ fontSize: 12, color: '#8A93A0', fontWeight: '500' }}>Удалить</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#8A93A0', textAlign: 'center', marginTop: 60, fontSize: 14 },

  modeToggle: { flexDirection: 'row', backgroundColor: 'rgba(14,23,38,0.07)', borderRadius: 13, padding: 3 },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  modeBtnActive: { backgroundColor: '#fff', shadowColor: '#0E1726', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  modeBtnText: { color: '#8A93A0', fontSize: 13, fontWeight: '500' },
  modeBtnTextActive: { color: '#0E1726', fontWeight: '700' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 14, marginTop: 10, marginBottom: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  searchInput: { flex: 1, color: '#0E1726', fontSize: 13.5 },

  noteCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(14,23,38,0.07)', borderRadius: 20, padding: 16, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  noteCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  noteTitle: { color: '#0E1726', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  noteDate: { color: '#8A93A0', fontSize: 11.5, marginTop: 3 },
  noteText: { color: '#5A6573', fontSize: 13, lineHeight: 19, marginTop: 4 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: '#0E1726', fontSize: 17, fontWeight: '700' },
  noteField: { backgroundColor: 'rgba(14,23,38,0.04)', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#0E1726', fontSize: 14, marginBottom: 10 },
  noteFieldMulti: { minHeight: 90, textAlignVertical: 'top' },
  saveNoteBtn: { backgroundColor: '#0E1726', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  saveNoteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
