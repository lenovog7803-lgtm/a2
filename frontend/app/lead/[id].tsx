import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Modal, Linking, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Trash2, Phone } from 'lucide-react-native';
import { theme, leadStatusLabels } from '../../src/theme';
import { api } from '../../src/api';
import { Field } from '../../src/components/Field';
import { ClientModal } from '../../src/components/ClientModal';
import { DateField } from '../../src/components/DateField';

const STATUSES = ['new', 'thinking', 'sent_kp', 'callback', 'won', 'lost'];

export default function LeadDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  useEffect(() => {
    const fetchWithRetry = async (attempts = 3) => { try { const data = await api.leads.get(id!); if (data) { setLead(data); setLoading(false); } else if (attempts > 1) { setTimeout(() => fetchWithRetry(attempts - 1), 500); } else { setLoading(false); } } catch { if (attempts > 1) setTimeout(() => fetchWithRetry(attempts - 1), 500); else setLoading(false); } }; fetchWithRetry();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const { call_notes, ...leadData } = lead;
      await api.leads.update(id!, leadData);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Удалить контакт?', lead?.name || '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await api.leads.delete(id!);
          router.back();
        } catch (e: any) {
          Alert.alert('Ошибка', e.message);
        }
      }},
    ]);
  };

  const update = (patch: any) => setLead((prev: any) => ({ ...prev, ...patch }));

  const refetchLead = async () => {
    const fresh = await api.leads.get(id!);
    if (fresh) setLead(fresh);
  };

  const addCallNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    setNoteLoading(true);
    setNewNote('');
    setShowNoteInput(false);
    try {
      const fresh = await api.leads.addCallNote(id!, text);
      setLead(fresh);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
      await refetchLead();
    } finally {
      setNoteLoading(false);
    }
  };

  const deleteNote = (i: number) => {
    Alert.alert('Удалить заметку?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        setNoteLoading(true);
        try {
          const fresh = await api.leads.deleteCallNote(id!, i);
          setLead(fresh);
        } catch (e: any) {
          Alert.alert('Ошибка', e.message);
          await refetchLead();
        } finally {
          setNoteLoading(false);
        }
      }},
    ]);
  };

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
          <Field label="Email" keyboardType="email-address" value={lead.email || ''} onChangeText={(v: string) => update({ email: v })} />
          <Field label="Город" value={lead.city} onChangeText={(v: string) => update({ city: v })} />
          <Field label="Отрасль" value={lead.industry || ''} onChangeText={(v: string) => update({ industry: v })} />
          <Field label="Направления" placeholder="МСК-СПб, МСК-НСК" value={lead.directions || ''} onChangeText={(v: string) => update({ directions: v })} />
          <DateField label="Следующий звонок" value={lead.next_call || ''} onChange={(v: string) => update({ next_call: v })} />
          <View style={styles.readOnlyWrap}>
            <Text style={styles.label}>ПОСЛЕДНИЙ ЗВОНОК</Text>
            <Text style={styles.readOnlyValue}>
              {lead.last_call ? lead.last_call.split('-').reverse().join('.') : '—'}
            </Text>
          </View>

          <Text style={styles.label}>СТАТУС</Text>
          <View style={styles.row}>
            {STATUSES.map(s => (
              <TouchableOpacity key={s} onPress={() => update({ status: s })} style={[styles.pill, lead.status === s && styles.pillActive]} activeOpacity={0.7}>
                <Text style={[styles.pillText, lead.status === s && styles.pillTextActive]}>{leadStatusLabels[s] || s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Заметки" multiline value={lead.notes || ''} onChangeText={(v: string) => update({ notes: v })} style={{ minHeight: 80, textAlignVertical: 'top' }} />

          <Text style={styles.label}>ЗАМЕТКИ ПОСЛЕ ЗВОНКОВ</Text>
          {noteLoading && <ActivityIndicator color={theme.colors.accent} style={{ marginBottom: 8 }} />}
          {(lead.call_notes || []).map((note: any, i: number) => (
            <View key={i} style={styles.callNoteItem}>
              <View style={styles.callNoteHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.callNoteDate}>
                    {note.date ? new Date(note.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </Text>
                  {!!note.author && <Text style={styles.callNoteAuthor}>{note.author}</Text>}
                </View>
                <TouchableOpacity onPress={() => deleteNote(i)} style={styles.noteActionBtn} activeOpacity={0.7} disabled={noteLoading}>
                  <Trash2 size={14} color={theme.colors.loss} strokeWidth={1.6} />
                </TouchableOpacity>
              </View>
              <Text style={styles.callNoteText}>{note.text}</Text>
            </View>
          ))}
          {showNoteInput ? (
            <View style={styles.noteInputWrap}>
              <TextInput
                style={styles.noteInput}
                placeholder="Введите заметку после звонка..."
                placeholderTextColor={theme.colors.textTertiary}
                value={newNote}
                onChangeText={setNewNote}
                multiline
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={addCallNote} disabled={noteLoading} style={[styles.noteConfirmBtn, noteLoading && { opacity: 0.6 }]} activeOpacity={0.8}>
                  <Text style={styles.noteConfirmText}>Сохранить</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowNoteInput(false); setNewNote(''); }} style={styles.noteCancelBtn} activeOpacity={0.8}>
                  <Text style={styles.noteCancelText}>Отмена</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowNoteInput(true)} activeOpacity={0.7}>
              <Text style={styles.addNoteBtnText}>+ Добавить заметку после звонка</Text>
            </TouchableOpacity>
          )}

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

  callNoteItem: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  callNoteHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  callNoteDate: { fontSize: 10, color: theme.colors.textTertiary, fontWeight: '600' },
  callNoteAuthor: { fontSize: 10, color: theme.colors.accent, fontWeight: '600', marginTop: 1 },
  callNoteText: { fontSize: 13, color: theme.colors.textPrimary, lineHeight: 18, marginTop: 4 },
  noteActionBtn: { padding: 6 },

  noteInputWrap: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  noteInput: {
    color: theme.colors.textPrimary, fontSize: 14,
    minHeight: 64, textAlignVertical: 'top',
  },
  noteConfirmBtn: {
    flex: 1, backgroundColor: theme.colors.accent,
    paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  noteConfirmText: { color: '#000', fontSize: 13, fontWeight: '700' },
  noteCancelBtn: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  noteCancelText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },

  addNoteBtn: {
    borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16,
  },
  addNoteBtnText: { color: theme.colors.textTertiary, fontSize: 13, fontWeight: '500' },

  readOnlyWrap: { marginBottom: 16 },
  readOnlyValue: { color: theme.colors.textSecondary, fontSize: 15, paddingVertical: 2 },
});
