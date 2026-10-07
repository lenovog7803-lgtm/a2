import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import {
  Play, Square, RefreshCw, Upload, Users, Plus, X, Send, Eye, Save, Plug, Inbox, Check, AlertTriangle, Mail,
} from 'lucide-react-native';
import { api } from '../../src/api';

// ---------- справочники ----------
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:        { label: 'Новый',         color: '#1366F0', bg: 'rgba(19,102,240,0.12)' },
  sent:       { label: 'Отправлено',    color: '#0CA6C0', bg: 'rgba(12,166,192,0.12)' },
  followup:   { label: 'Напоминание',   color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  replied:    { label: 'Ответили',      color: '#1E9E5A', bg: 'rgba(30,158,90,0.14)' },
  interested: { label: 'Интересно',     color: '#1E9E5A', bg: 'rgba(30,158,90,0.14)' },
  deal:       { label: 'Сделка',        color: '#0E1726', bg: 'rgba(14,23,38,0.10)' },
  refused:    { label: 'Отказ',         color: '#8A93A0', bg: 'rgba(138,147,160,0.14)' },
  bounce:     { label: 'Ошибка адреса', color: '#E0473B', bg: 'rgba(224,71,59,0.12)' },
  error:      { label: 'Ошибка',        color: '#E0473B', bg: 'rgba(224,71,59,0.12)' },
  skip:       { label: 'Не отправлять', color: '#A6AEB8', bg: 'rgba(166,174,184,0.14)' },
};
const STATUS_KEYS = Object.keys(STATUS_META);
const SECTIONS = [
  { k: 'overview', label: 'Обзор' }, { k: 'contacts', label: 'Контакты' },
  { k: 'letter', label: 'Письмо' }, { k: 'settings', label: 'Настройки' },
];
const PRESETS: Record<string, { label: string; v: [string, number, string, number] }> = {
  yandex: { label: 'Яндекс / Яндекс 360', v: ['smtp.yandex.ru', 465, 'imap.yandex.ru', 993] },
  gmail:  { label: 'Gmail', v: ['smtp.gmail.com', 465, 'imap.gmail.com', 993] },
  mailru: { label: 'Mail.ru', v: ['smtp.mail.ru', 465, 'imap.mail.ru', 993] },
};
const PLACEHOLDERS = ['{приветствие}', '{компания}', '{имя_контакта}', '{моё_имя}', '{моя_компания}', '{телефон}'];
const GRADIENTS = [
  ['#FFD8A8', '#FF922B'], ['#D0BFFF', '#7C3AED'], ['#A5D8FF', '#1366F0'],
  ['#B2F2BB', '#1E9E5A'], ['#FFC9C9', '#E0473B'], ['#99E9F2', '#0CA6C0'],
];
const avatarIdx = (n: string) => (n || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length;
const initials = (name: string) => {
  const w = (name || '').replace(/^(ООО|АО|ОАО|ЗАО|ТД|ИП|ПАО)\s+/i, '').split(/[\s-]+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase() || '?';
};
const fmtDate = (s?: string) => { if (!s) return ''; const p = s.slice(0, 10).split('-'); return `${p[2]}.${p[1]}`; };
const fmtTs = (s?: string) => { if (!s) return ''; const d = s.slice(0, 10).split('-'); return `${d[2]}.${d[1]} ${s.slice(11, 16)}`; };
const isWeb = Platform.OS === 'web';
const errText = (e: any) => {
  const m = String(e?.message || e || 'Ошибка');
  const j = m.match(/\{.*\}/);
  if (j) { try { return JSON.parse(j[0]).detail || m; } catch {} }
  return m;
};

export default function Mailing() {
  const [section, setSection] = useState('overview');
  const [st, setSt] = useState<any>(null);
  const [toast, setToast] = useState<{ t: string; bad?: boolean } | null>(null);
  const toastTimer = useRef<any>(null);
  const notify = (t: string, bad = false) => {
    setToast({ t, bad }); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const loadState = useCallback(async () => {
    try { setSt(await api.mailing.state()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadState();
    const t = setInterval(loadState, 5000);
    return () => clearInterval(t);
  }, [loadState]));

  const toggleRun = async () => {
    try {
      if (st?.running) { await api.mailing.stop(); notify('Рассылка остановлена'); }
      else { await api.mailing.start(); notify('Рассылка запущена'); }
      loadState();
    } catch (e) { notify(errText(e), true); }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Topbar */}
        <View style={styles.topbar}>
          <Text style={styles.topTitle}>Рассылка</Text>
          {st ? (
            <View style={[styles.livePill, st.running ? styles.livePillOn : null]}>
              <View style={[styles.liveDot, { backgroundColor: st.running ? '#1E9E5A' : '#A6AEB8' }]} />
              <Text style={[styles.livePillText, st.running && { color: '#1E9E5A' }]}>{st.running ? 'Идёт' : 'Остановлена'}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.refreshBtn} onPress={loadState}>
            <RefreshCw size={16} color="#5A6573" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, st?.running && styles.stopBtn]} onPress={toggleRun} activeOpacity={0.8}>
            {st?.running ? <Square size={14} color="#fff" fill="#fff" /> : <Play size={15} color="#fff" fill="#fff" />}
            <Text style={styles.addBtnText}>{st?.running ? 'Остановить' : 'Запустить рассылку'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.page}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SECTIONS.map(s => (
              <TouchableOpacity key={s.k} style={[styles.chip, section === s.k && styles.chipActive]} onPress={() => setSection(s.k)} activeOpacity={0.7}>
                <Text style={[styles.chipText, section === s.k && styles.chipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {st && !st.configured && section !== 'settings' ? (
            <TouchableOpacity style={styles.hint} onPress={() => setSection('settings')} activeOpacity={0.8}>
              <AlertTriangle size={16} color="#D97706" />
              <Text style={styles.hintText}>Чтобы начать, укажите почту и пароль приложения во вкладке «Настройки».</Text>
            </TouchableOpacity>
          ) : null}

          {section === 'overview' && <Overview st={st} notify={notify} reload={loadState} />}
          {section === 'contacts' && <Contacts notify={notify} reloadState={loadState} />}
          {section === 'letter' && <Letter notify={notify} />}
          {section === 'settings' && <Settings notify={notify} reloadState={loadState} />}
        </View>
      </ScrollView>
      {toast ? (
        <View style={[styles.toast, toast.bad && { backgroundColor: '#B42318' }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast.t}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ================= Обзор =================
function Overview({ st, notify, reload }: { st: any; notify: (t: string, b?: boolean) => void; reload: () => void }) {
  const [checking, setChecking] = useState(false);
  if (!st) return <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>;
  const c = st.counts || {};
  const sentTotal = ['sent', 'followup', 'replied', 'interested', 'refused', 'deal'].reduce((a, k) => a + (c[k] || 0), 0);
  const replied = (c.replied || 0) + (c.interested || 0) + (c.deal || 0);
  const errors = (c.bounce || 0) + (c.error || 0);
  const rate = sentTotal ? Math.round((replied / sentTotal) * 100) : 0;
  const pct = st.limit ? Math.min(1, st.sent_today / st.limit) : 0;

  const checkNow = async () => {
    setChecking(true);
    try { const r = await api.mailing.checkInbox(); notify(`Ответили: ${r.replied}, ошибок адреса: ${r.bounced}`); reload(); }
    catch (e) { notify(errText(e), true); } finally { setChecking(false); }
  };

  return (
    <>
      <View style={styles.topRow}>
        <LinearGradient colors={['#0E1726', '#1C2740']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroOrb} />
          <Text style={styles.heroLabel}>{st.running ? 'Сейчас' : 'Статус'}</Text>
          <Text style={styles.heroState} numberOfLines={2}>{st.running ? st.state : 'Рассылка остановлена'}</Text>
          {st.running && st.next_at ? <Text style={styles.heroNext}>Следующее действие в {st.next_at} (Мск)</Text> : null}
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} /></View>
          <View style={styles.heroRow}>
            <View><Text style={styles.heroStatLabel}>Сегодня</Text><Text style={styles.heroStatVal}>{st.sent_today} / {st.limit}</Text></View>
            <View><Text style={styles.heroStatLabel}>В очереди</Text><Text style={styles.heroStatVal}>{st.queue_new}</Text></View>
            <View><Text style={styles.heroStatLabel}>Ждут напоминания</Text><Text style={styles.heroStatVal}>{st.queue_follow}</Text></View>
          </View>
        </LinearGradient>
        <View style={styles.cashflowCol}>
          <View style={styles.cardGreen}>
            <Text style={styles.cashflowLabel}>Ответили</Text>
            <Text style={styles.valGreen}>{replied}</Text>
            <Text style={styles.cashflowSub}>{rate}% от отправленных</Text>
          </View>
          <View style={styles.cardRed}>
            <Text style={styles.cashflowLabel}>Ошибки</Text>
            <Text style={styles.valRed}>{errors}</Text>
            <Text style={styles.cashflowSub}>неверные адреса и сбои отправки</Text>
          </View>
        </View>
      </View>

      <View style={styles.kpiRow}>
        {[
          { v: sentTotal, l: 'Отправлено всего', c: '#0CA6C0' },
          { v: c.followup || 0, l: 'С напоминанием', c: '#7C3AED' },
          { v: st.total, l: 'Контактов в базе', c: '#1366F0' },
          { v: st.with_email, l: 'С email', c: '#D97706' },
        ].map(k => (
          <View key={k.l} style={styles.kpiCard}>
            <View style={[styles.kpiDot, { backgroundColor: k.c + '1F' }]}><View style={[styles.kpiDotInner, { backgroundColor: k.c }]} /></View>
            <Text style={[styles.kpiValue, { color: '#0E1726' }]}>{k.v}</Text>
            <Text style={styles.kpiLabel}>{k.l}</Text>
          </View>
        ))}
      </View>

      <View style={styles.glassCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Журнал</Text>
            <Text style={styles.cardSub}>Последние 100 событий</Text>
          </View>
          <TouchableOpacity style={styles.ghostBtn} onPress={checkNow} disabled={checking}>
            <Inbox size={15} color="#0E1726" />
            <Text style={styles.ghostBtnText}>{checking ? 'Проверяю…' : 'Проверить ответы'}</Text>
          </TouchableOpacity>
        </View>
        {(st.log || []).length === 0 ? <Text style={styles.empty}>Пока ничего не отправлялось</Text> : null}
        {(st.log || []).map((l: any) => (
          <View key={l.id} style={styles.logRow}>
            <View style={[styles.logIcon, { backgroundColor: l.ok ? 'rgba(30,158,90,0.12)' : 'rgba(224,71,59,0.12)' }]}>
              {l.ok ? <Check size={13} color="#1E9E5A" strokeWidth={3} /> : <X size={13} color="#E0473B" strokeWidth={3} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.clientName} numberOfLines={1}>{l.company || l.email || '—'} <Text style={styles.logKind}>· {l.kind}</Text></Text>
              <Text style={styles.clientSub} numberOfLines={1}>{l.email ? `${l.email} — ` : ''}{l.detail}</Text>
            </View>
            <Text style={styles.logTime}>{fmtTs(l.ts)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ================= Контакты =================
function Contacts({ notify, reloadState }: { notify: (t: string, b?: boolean) => void; reloadState: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [statusFor, setStatusFor] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.mailing.contacts()); } catch (e) { notify(errText(e), true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ql = q.trim().toLowerCase();
  const filtered = items
    .filter(c => !filter || c.status === filter)
    .filter(c => !ql || [c.company, c.email, c.city, c.site].some((v: string) => (v || '').toLowerCase().includes(ql)));
  const counts: Record<string, number> = {};
  items.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });

  const patch = async (c: any, data: any) => {
    try { await api.mailing.updateContact(c.id, data); setItems(arr => arr.map(x => x.id === c.id ? { ...x, ...data } : x)); reloadState(); }
    catch (e) { notify(errText(e), true); load(); }
  };
  const remove = async (c: any) => {
    if (isWeb && !(window as any).confirm(`Удалить «${c.company || c.email}» из рассылки?`)) return;
    try { await api.mailing.deleteContact(c.id); setItems(arr => arr.filter(x => x.id !== c.id)); reloadState(); }
    catch (e) { notify(errText(e), true); }
  };
  const importXlsx = () => {
    if (!isWeb) { notify('Импорт Excel доступен в веб-версии CRM', true); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx';
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      setBusy(true);
      try { const r = await api.mailing.importXlsx(f); notify(`Добавлено: ${r.added}, пропущено дублей: ${r.skipped}`); load(); reloadState(); }
      catch (e) { notify(errText(e), true); } finally { setBusy(false); }
    };
    input.click();
  };
  const fromLeads = async () => {
    setBusy(true);
    try { const r = await api.mailing.fromLeads(); notify(`Из базы обзвона добавлено: ${r.added}, уже были: ${r.skipped}`); load(); reloadState(); }
    catch (e) { notify(errText(e), true); } finally { setBusy(false); }
  };

  return (
    <>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <TextInput value={q} onChangeText={setQ} placeholder="Поиск: компания, email, город…" placeholderTextColor="#A6AEB8" style={styles.searchInput} />
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.ghostBtn} onPress={importXlsx} disabled={busy}>
          <Upload size={15} color="#0E1726" /><Text style={styles.ghostBtnText}>Импорт Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={fromLeads} disabled={busy}>
          <Users size={15} color="#0E1726" /><Text style={styles.ghostBtnText}>Из базы обзвона</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Plus size={16} color="#fff" strokeWidth={2.2} /><Text style={styles.addBtnText}>Добавить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <TouchableOpacity style={[styles.chip, !filter && styles.chipActive]} onPress={() => setFilter('')}>
          <Text style={[styles.chipText, !filter && styles.chipTextActive]}>Все  {items.length}</Text>
        </TouchableOpacity>
        {STATUS_KEYS.filter(k => counts[k]).map(k => (
          <TouchableOpacity key={k} style={[styles.chip, filter === k && styles.chipActive]} onPress={() => setFilter(k)}>
            <Text style={[styles.chipText, filter === k && styles.chipTextActive]}>{STATUS_META[k].label}  {counts[k]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View> : (
        <View style={styles.tableWrap}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>{items.length ? 'Ничего не найдено' : 'Контактов нет. Загрузите Excel с покупателями или добавьте компании из базы обзвона.'}</Text>
          ) : null}
          {filtered.slice(0, 500).map((c, i) => {
            const meta = STATUS_META[c.status] || STATUS_META.new;
            const [a, b] = GRADIENTS[avatarIdx(c.company || c.email)];
            return (
              <View key={c.id} style={[styles.row, i === Math.min(filtered.length, 500) - 1 && { borderBottomWidth: 0 }]}>
                <LinearGradient colors={[a, b]} style={styles.avatar}><Text style={styles.avatarText}>{initials(c.company || c.email)}</Text></LinearGradient>
                <View style={{ flex: 1.3, minWidth: 0 }}>
                  <Text style={styles.clientName} numberOfLines={1}>{c.company || '—'}{c.priority ? <Text style={styles.prio}>  {c.priority}</Text> : null}</Text>
                  <Text style={styles.clientSub} numberOfLines={1}>{[c.city, (c.site || '').replace(/^https?:\/\/(www\.)?/, '')].filter(Boolean).join(' · ')}</Text>
                  {c.last_error ? <Text style={styles.errLine} numberOfLines={1}>{c.last_error}</Text> : null}
                </View>
                <EmailCell value={c.email} onSave={v => v !== (c.email || '') && patch(c, { email: v })} />
                <TouchableOpacity style={[styles.badge, { backgroundColor: meta.bg }]} onPress={() => setStatusFor(c)}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </TouchableOpacity>
                <Text style={styles.dates}>{fmtDate(c.first_sent)}{c.followup_sent ? ` / ${fmtDate(c.followup_sent)}` : ''}</Text>
                <TouchableOpacity style={styles.iconBtn} onPress={() => remove(c)}><X size={14} color="#8A93A0" /></TouchableOpacity>
              </View>
            );
          })}
          {filtered.length > 500 ? <Text style={styles.empty}>Показаны первые 500 — уточните поиск</Text> : null}
        </View>
      )}

      {statusFor ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setStatusFor(null)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setStatusFor(null)}>
            <View style={[styles.modal, { maxWidth: 340 }]}>
              <Text style={[styles.modalTitle, { marginBottom: 14 }]} numberOfLines={1}>{statusFor.company || statusFor.email}</Text>
              {STATUS_KEYS.map(k => (
                <TouchableOpacity key={k} style={[styles.statusOpt, statusFor.status === k && { backgroundColor: 'rgba(14,23,38,0.05)' }]}
                  onPress={() => { patch(statusFor, { status: k }); setStatusFor(null); }}>
                  <View style={[styles.liveDot, { backgroundColor: STATUS_META[k].color }]} />
                  <Text style={styles.statusOptText}>{STATUS_META[k].label}</Text>
                  {statusFor.status === k ? <Check size={15} color="#1366F0" /> : null}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
      {showAdd ? <AddModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); reloadState(); notify('Контакт добавлен'); }} notify={notify} /> : null}
    </>
  );
}

function EmailCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return (
    <TextInput value={v} onChangeText={setV} onBlur={() => onSave(v.trim())} onSubmitEditing={() => onSave(v.trim())}
      placeholder="вписать email" placeholderTextColor="#A6AEB8" autoCapitalize="none" keyboardType="email-address"
      style={[styles.emailInput, !v && { borderStyle: 'dashed' as any }]} />
  );
}

function AddModal({ onClose, onSaved, notify }: { onClose: () => void; onSaved: () => void; notify: (t: string, b?: boolean) => void }) {
  const [f, setF] = useState({ company: '', email: '', contact_name: '', city: '', site: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await api.mailing.addContact(f); onSaved(); } catch (e) { notify(errText(e), true); } finally { setSaving(false); }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Новый контакт</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#5A6573" /></TouchableOpacity>
          </View>
          {[['company', 'КОМПАНИЯ', 'ООО «Пример»'], ['email', 'EMAIL', 'zakupki@example.ru'], ['contact_name', 'ИМЯ КОНТАКТА', 'необязательно'],
            ['city', 'ГОРОД', 'Москва'], ['site', 'САЙТ', 'example.ru']].map(([k, l, p]) => (
            <View key={k} style={styles.formGroup}>
              <Text style={styles.formLabel}>{l}</Text>
              <TextInput style={styles.formInput} value={(f as any)[k]} onChangeText={v => set(k, v)} placeholder={p} placeholderTextColor="#A6AEB8" autoCapitalize="none" />
            </View>
          ))}
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Отмена</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}><Text style={styles.saveText}>{saving ? 'Сохранение…' : 'Добавить'}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ================= Письмо =================
function Letter({ notify }: { notify: (t: string, b?: boolean) => void }) {
  const [form, setForm] = useState<any>(null);
  const [prev, setPrev] = useState<any>(null);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState('');
  const [focused, setFocused] = useState<'body' | 'followup_body' | 'subjects'>('body');

  useEffect(() => {
    api.mailing.settings().then((s: any) => setForm({
      subjects: (s.subjects || []).join('\n'), body: s.body || '', followup_body: s.followup_body || '',
    })).catch(e => notify(errText(e), true));
  }, []);
  if (!form) return <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>;

  const run = async (k: string, fn: () => Promise<any>) => { setBusy(k); try { await fn(); } catch (e) { notify(errText(e), true); } finally { setBusy(''); } };
  const save = () => run('save', async () => { await api.mailing.saveSettings(form); notify('Письмо сохранено'); });
  const preview = () => run('prev', async () => setPrev(await api.mailing.preview(form)));
  const test = () => run('test', async () => { await api.mailing.saveSettings(form); await api.mailing.testEmail(testTo); notify('Пробное письмо отправлено — проверьте «Входящие» и «Спам»'); });
  const insert = (ph: string) => setForm((f: any) => ({ ...f, [focused]: (f[focused] || '') + ph }));

  return (
    <View style={styles.twoCol}>
      <View style={[styles.glassCard, { flex: 1.15 }]}>
        <Text style={styles.cardTitle}>Текст письма</Text>
        <Text style={[styles.cardSub, { marginBottom: 14 }]}>Тема выбирается случайно из списка — так письма не одинаковые</Text>
        <Text style={styles.formLabel}>ТЕМЫ — КАЖДАЯ С НОВОЙ СТРОКИ</Text>
        <TextInput style={[styles.formInput, { minHeight: 74 }]} multiline value={form.subjects} onFocus={() => setFocused('subjects')}
          onChangeText={v => setForm({ ...form, subjects: v })} />
        <Text style={[styles.formLabel, { marginTop: 14 }]}>ПЕРВОЕ ПИСЬМО</Text>
        <TextInput style={[styles.formInput, { minHeight: 300 }]} multiline value={form.body} onFocus={() => setFocused('body')}
          onChangeText={v => setForm({ ...form, body: v })} />
        <Text style={[styles.formLabel, { marginTop: 14 }]}>НАПОМИНАНИЕ (ОТВЕТОМ В ТУ ЖЕ ПЕРЕПИСКУ)</Text>
        <TextInput style={[styles.formInput, { minHeight: 140 }]} multiline value={form.followup_body} onFocus={() => setFocused('followup_body')}
          onChangeText={v => setForm({ ...form, followup_body: v })} />
        <View style={styles.phWrap}>
          {PLACEHOLDERS.map(p => (
            <TouchableOpacity key={p} style={styles.ph} onPress={() => insert(p)}><Text style={styles.phText}>{p}</Text></TouchableOpacity>
          ))}
        </View>
        <View style={[styles.formActions, { borderTopWidth: 0, paddingTop: 8 }]}>
          <TouchableOpacity style={styles.cancelBtn} onPress={preview}>
            <View style={styles.btnInner}><Eye size={15} color="#5A6573" /><Text style={styles.cancelText}>{busy === 'prev' ? '…' : 'Предпросмотр'}</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <View style={styles.btnInner}><Save size={15} color="#fff" /><Text style={styles.saveText}>{busy === 'save' ? 'Сохранение…' : 'Сохранить'}</Text></View>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flex: 1, gap: 16 }}>
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>Пробное письмо себе</Text>
          <Text style={[styles.cardSub, { marginBottom: 12 }]}>Убедитесь, что оно пришло во «Входящие», а не в «Спам»</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput style={[styles.formInput, { flex: 1 }]} value={testTo} onChangeText={setTestTo} placeholder="ваш email" placeholderTextColor="#A6AEB8" autoCapitalize="none" />
            <TouchableOpacity style={styles.addBtn} onPress={test}>
              <Send size={15} color="#fff" /><Text style={styles.addBtnText}>{busy === 'test' ? '…' : 'Отправить'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>Предпросмотр</Text>
          <Text style={[styles.cardSub, { marginBottom: 12 }]}>{prev ? `Так увидит «${prev.company}»` : 'Нажмите «Предпросмотр»'}</Text>
          {prev ? (
            <>
              <View style={styles.mailPrev}>
                <View style={styles.mailHead}><Mail size={14} color="#1366F0" /><Text style={styles.mailSubj} numberOfLines={1}>{prev.first.subject}</Text></View>
                <Text style={styles.mailBody}>{prev.first.body}</Text>
              </View>
              <Text style={[styles.formLabel, { marginTop: 14 }]}>НАПОМИНАНИЕ</Text>
              <View style={styles.mailPrev}>
                <View style={styles.mailHead}><Mail size={14} color="#7C3AED" /><Text style={styles.mailSubj} numberOfLines={1}>{prev.follow.subject}</Text></View>
                <Text style={styles.mailBody}>{prev.follow.body}</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ================= Настройки =================
function Settings({ notify, reloadState }: { notify: (t: string, b?: boolean) => void; reloadState: () => void }) {
  const [s, setS] = useState<any>(null);
  const [conn, setConn] = useState<any>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { api.mailing.settings().then(setS).catch(e => notify(errText(e), true)); }, []);
  if (!s) return <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>;

  const set = (k: string, v: any) => setS((x: any) => ({ ...x, [k]: v }));
  const connectGoogle = async () => {
    try {
      await api.mailing.saveSettings({ transport: 'gmail_api' });
      const r = await api.mailing.googleStart();
      if (isWeb) (window as any).open(r.auth_url, '_blank'); else notify('Откройте CRM в браузере, чтобы подключить Google', true);
    } catch (e) { notify(errText(e), true); }
  };
  const payload = () => { const { body, followup_body, subjects, running, password_from_env, gmail_connected, ...rest } = s; return rest; };
  const save = async () => {
    setBusy('save');
    try { await api.mailing.saveSettings(payload()); notify('Настройки сохранены'); reloadState(); } catch (e) { notify(errText(e), true); } finally { setBusy(''); }
  };
  const test = async () => {
    setBusy('conn'); setConn(null);
    try { await api.mailing.saveSettings(payload()); setConn(await api.mailing.testConnection()); reloadState(); } catch (e) { notify(errText(e), true); } finally { setBusy(''); }
  };
  const field = (k: string, label: string, opts: any = {}) => (
    <View style={[styles.formGroup, { flex: opts.flex || 1, minWidth: opts.min || 140 }]}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput style={styles.formInput} value={String(s[k] ?? '')} onChangeText={v => set(k, v)} placeholder={opts.ph || ''}
        placeholderTextColor="#A6AEB8" secureTextEntry={opts.secret} autoCapitalize="none" keyboardType={opts.num ? 'numeric' : 'default'} />
    </View>
  );
  const toggle = (k: string, label: string) => (
    <TouchableOpacity style={styles.toggleRow} onPress={() => set(k, !s[k])} activeOpacity={0.7}>
      <View style={[styles.switch, s[k] && styles.switchOn]}><View style={[styles.knob, s[k] && styles.knobOn]} /></View>
      <Text style={styles.toggleText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.twoCol}>
      <View style={[styles.glassCard, { flex: 1 }]}>
        <Text style={styles.cardTitle}>Почта для рассылки</Text>
        <Text style={[styles.cardSub, { marginBottom: 14 }]}>Лучше ящик на своём домене, например egor@a2group.by</Text>
        <Text style={styles.formLabel}>СПОСОБ ОТПРАВКИ</Text>
        <View style={[styles.chips, { marginBottom: 10, flexWrap: 'wrap' }]}>
          {[['gmail_api', 'Через Google (Gmail)'], ['smtp', 'SMTP по паролю приложения']].map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.chip, (s.transport || 'smtp') === k && styles.chipActive]} onPress={() => set('transport', k)}>
              <Text style={[styles.chipText, (s.transport || 'smtp') === k && styles.chipTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {s.transport === 'gmail_api' ? (
          <View style={styles.gBox}>
            <Text style={styles.helpText}>
              Письма уходят через Gmail по HTTPS — работает на любом хостинге. Можно выбрать любой Gmail,
              не обязательно тот, что подключён к CRM: Документы, Календарь и Задачи остаются на прежнем аккаунте.
              {s.gmail_connected ? `\nПодключён: ${s.gmail_connected}` : ''}
            </Text>
            <TouchableOpacity style={[styles.ghostBtn, { alignSelf: 'flex-start', marginTop: 10 }]} onPress={connectGoogle}>
              <Mail size={15} color="#0E1726" /><Text style={styles.ghostBtnText}>Подключить Gmail для рассылки</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={[styles.chips, { marginBottom: 12, flexWrap: 'wrap' }]}>
          {Object.entries(PRESETS).map(([k, p]) => (
            <TouchableOpacity key={k} style={[styles.chip, s.smtp_host === p.v[0] && styles.chipActive]}
              onPress={() => setS((x: any) => ({ ...x, smtp_host: p.v[0], smtp_port: p.v[1], imap_host: p.v[2], imap_port: p.v[3] }))}>
              <Text style={[styles.chipText, s.smtp_host === p.v[0] && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.fieldRow}>{field('smtp_host', 'SMTP СЕРВЕР', { flex: 2 })}{field('smtp_port', 'ПОРТ', { num: true, min: 80 })}</View>
        <View style={styles.fieldRow}>{field('imap_host', 'IMAP (ПРОВЕРКА ОТВЕТОВ)', { flex: 2 })}{field('imap_port', 'ПОРТ', { num: true, min: 80 })}</View>
        {field('login', s.transport === 'gmail_api' ? 'ВАШ GMAIL' : 'EMAIL (ЛОГИН)', { ph: s.transport === 'gmail_api' ? 'name@gmail.com' : 'egor@a2group.by' })}
        {s.password_from_env
          ? <Text style={styles.envNote}>Пароль задан на сервере (переменная MAIL_PASSWORD)</Text>
          : field('password', s.transport === 'gmail_api' ? 'ПАРОЛЬ ПРИЛОЖЕНИЯ (ДЛЯ ПРОВЕРКИ ОТВЕТОВ ПО IMAP)' : 'ПАРОЛЬ ПРИЛОЖЕНИЯ', { secret: true, ph: 'не обычный пароль от почты' })}
        {field('from_name', 'ИМЯ ОТПРАВИТЕЛЯ (ВИДИТ ПОЛУЧАТЕЛЬ)')}
        <Text style={styles.helpText}>
          Пароль приложения: Яндекс — id.yandex.ru → Безопасность → Пароли приложений → «Почта» (и включите IMAP в настройках почты).
          Gmail — включите двухэтапную аутентификацию → myaccount.google.com/apppasswords.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <TouchableOpacity style={styles.ghostBtn} onPress={test}>
            <Plug size={15} color="#0E1726" /><Text style={styles.ghostBtnText}>{busy === 'conn' ? 'Проверяю…' : 'Проверить подключение'}</Text>
          </TouchableOpacity>
          {conn ? (
            <Text style={styles.connText}>
              Отправка: <Text style={{ color: conn.smtp === 'ok' ? '#1E9E5A' : '#E0473B' }}>{conn.smtp}</Text>
              {conn.imap ? <>{'  ·  '}Входящие: <Text style={{ color: conn.imap === 'ok' ? '#1E9E5A' : '#E0473B' }}>{conn.imap}</Text></> : null}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ flex: 1, gap: 16 }}>
        <View style={styles.glassCard}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Подпись</Text>
          <View style={styles.fieldRow}>{field('my_name', 'ИМЯ')}{field('my_company', 'КОМПАНИЯ')}</View>
          {field('phone', 'ТЕЛЕФОН / МЕССЕНДЖЕРЫ', { ph: '+375 … (WhatsApp / Telegram)' })}
        </View>
        <View style={styles.glassCard}>
          <Text style={styles.cardTitle}>Лимиты и защита от спама</Text>
          <Text style={[styles.cardSub, { marginBottom: 12 }]}>Первую неделю — 15–20 писем в день, затем до 40–50</Text>
          <View style={styles.fieldRow}>{field('daily_limit', 'ПИСЕМ В ДЕНЬ', { num: true, min: 90 })}{field('min_delay', 'ПАУЗА ОТ, СЕК', { num: true, min: 90 })}{field('max_delay', 'ПАУЗА ДО, СЕК', { num: true, min: 90 })}</View>
          <View style={styles.fieldRow}>{field('hour_start', 'С, ЧАС (МСК)', { num: true, min: 90 })}{field('hour_end', 'ДО, ЧАС (МСК)', { num: true, min: 90 })}{field('followup_days', 'НАПОМНИТЬ ЧЕРЕЗ, ДН', { num: true, min: 90 })}</View>
          {toggle('weekdays_only', 'Отправлять только в будни')}
          {toggle('followup_enabled', 'Слать напоминание тем, кто не ответил')}
        </View>
        <TouchableOpacity style={[styles.saveBtn, { flex: 0, paddingVertical: 15 }]} onPress={save}>
          <View style={styles.btnInner}><Save size={16} color="#fff" /><Text style={styles.saveText}>{busy === 'save' ? 'Сохранение…' : 'Сохранить настройки'}</Text></View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const GLASS = { backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' };

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#EDEFF3' }, content: { flexGrow: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, backgroundColor: 'rgba(237,239,243,0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)', gap: 12 },
  topTitle: { fontFamily: 'Onest_700Bold', fontSize: 22, color: '#0E1726', letterSpacing: -0.5 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)' },
  livePillOn: { backgroundColor: 'rgba(30,158,90,0.10)', borderColor: 'rgba(30,158,90,0.22)' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  livePillText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: '#5A6573' },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, ...GLASS, borderColor: 'rgba(14,23,38,0.08)', alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 13, backgroundColor: '#0E1726', shadowColor: '#0E1726', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
  stopBtn: { backgroundColor: '#E0473B', shadowColor: '#E0473B' },
  addBtnText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13.5, color: '#fff' },
  page: { padding: 24, gap: 16 },
  chips: { flexDirection: 'row', gap: 9 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)' },
  chipActive: { backgroundColor: '#0E1726', borderColor: 'transparent' },
  chipText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: '#5A6573' },
  chipTextActive: { color: '#fff' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(217,119,6,0.10)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.22)' },
  hintText: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: '#8A5300', flex: 1 },
  loaderWrap: { paddingVertical: 40, alignItems: 'center' },

  topRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  heroCard: { flex: 1.4, minWidth: 320, borderRadius: 24, padding: 24, overflow: 'hidden', position: 'relative' as any },
  heroOrb: { position: 'absolute' as any, width: 220, height: 220, top: -70, right: -50, borderRadius: 110, backgroundColor: 'rgba(19,102,240,0.2)' },
  heroLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  heroState: { fontFamily: 'Onest_800ExtraBold', fontSize: 24, color: '#fff', letterSpacing: -0.6 },
  heroNext: { fontFamily: 'Manrope_500Medium', fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 18, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#5B9BFF' },
  heroRow: { flexDirection: 'row', gap: 28, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  heroStatLabel: { fontFamily: 'Manrope_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  heroStatVal: { fontFamily: 'Onest_700Bold', fontSize: 18, color: '#fff', marginTop: 3 },
  cashflowCol: { flex: 1, minWidth: 240, gap: 16 },
  cardGreen: { flex: 1, borderRadius: 22, padding: 20, backgroundColor: 'rgba(30,158,90,0.1)', borderWidth: 1, borderColor: 'rgba(30,158,90,0.2)' },
  cardRed: { flex: 1, borderRadius: 22, padding: 20, backgroundColor: 'rgba(224,71,59,0.08)', borderWidth: 1, borderColor: 'rgba(224,71,59,0.18)' },
  cashflowLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: '#5A6573', marginBottom: 6 },
  valGreen: { fontFamily: 'Onest_700Bold', fontSize: 26, color: '#1E9E5A', letterSpacing: -0.5 },
  valRed: { fontFamily: 'Onest_700Bold', fontSize: 26, color: '#E0473B', letterSpacing: -0.5 },
  cashflowSub: { fontFamily: 'Manrope_400Regular', fontSize: 11.5, color: '#8A93A0', marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  kpiCard: { flex: 1, minWidth: 150, borderRadius: 20, padding: 18, ...GLASS, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20 },
  kpiDot: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiDotInner: { width: 10, height: 10, borderRadius: 5 },
  kpiValue: { fontFamily: 'Onest_800ExtraBold', fontSize: 26, letterSpacing: -0.5, marginBottom: 4 },
  kpiLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, color: '#8A93A0' },
  twoCol: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' },
  glassCard: { borderRadius: 22, padding: 22, minWidth: 320, ...GLASS, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 28 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontFamily: 'Onest_700Bold', fontSize: 16, color: '#0E1726' },
  cardSub: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: '#8A93A0', marginTop: 2 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(14,23,38,0.10)' },
  ghostBtnText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: '#0E1726' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(14,23,38,0.05)' },
  logIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logKind: { fontFamily: 'Manrope_500Medium', color: '#8A93A0' },
  logTime: { fontFamily: 'Onest_700Bold', fontSize: 12, color: '#8A93A0', flexShrink: 0 },
  clientName: { fontFamily: 'Manrope_600SemiBold', fontSize: 13.5, color: '#0E1726' },
  clientSub: { fontFamily: 'Manrope_400Regular', fontSize: 11.5, color: '#8A93A0', marginTop: 2 },
  empty: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: '#A6AEB8', textAlign: 'center', padding: 28 },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchBox: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, ...GLASS, borderColor: 'rgba(14,23,38,0.08)', minWidth: 280 },
  searchInput: { fontFamily: 'Manrope_500Medium', fontSize: 13.5, color: '#0E1726' },
  tableWrap: { borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)', shadowColor: '#0E1726', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(14,23,38,0.05)' },
  avatar: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontFamily: 'Onest_700Bold', fontSize: 12 },
  prio: { fontFamily: 'Onest_700Bold', fontSize: 11, color: '#1366F0' },
  errLine: { fontFamily: 'Manrope_500Medium', fontSize: 11, color: '#E0473B', marginTop: 2 },
  emailInput: { flex: 1, minWidth: 170, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(14,23,38,0.12)', backgroundColor: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope_500Medium', fontSize: 13, color: '#0E1726' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexShrink: 0, minWidth: 104, alignItems: 'center' },
  badgeText: { fontFamily: 'Manrope_700Bold', fontSize: 11, fontWeight: '700' },
  dates: { fontFamily: 'Onest_700Bold', fontSize: 12, color: '#5A6573', width: 86, textAlign: 'right' },
  iconBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(14,23,38,0.04)', alignItems: 'center', justifyContent: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(20,28,46,0.34)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modal: { width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#0E1726', shadowOffset: { width: 0, height: 40 }, shadowOpacity: 0.4, shadowRadius: 60, padding: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(14,23,38,0.07)' },
  modalTitle: { fontFamily: 'Onest_700Bold', fontSize: 18, color: '#0E1726' },
  closeBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(14,23,38,0.04)', alignItems: 'center', justifyContent: 'center' },
  statusOpt: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 11 },
  statusOptText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: '#0E1726', flex: 1 },
  formGroup: { marginBottom: 14 },
  formLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 11.5, letterSpacing: 0.6, color: '#8A93A0', marginBottom: 7 },
  formInput: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(14,23,38,0.12)', backgroundColor: 'rgba(255,255,255,0.75)', fontFamily: 'Manrope_400Regular', fontSize: 14, color: '#0E1726', textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 6, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(14,23,38,0.07)' },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(14,23,38,0.12)', backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center' },
  cancelText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: '#5A6573' },
  saveBtn: { flex: 2, paddingVertical: 13, borderRadius: 13, backgroundColor: '#1E9E5A', alignItems: 'center' },
  saveText: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, color: '#fff' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  ph: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(19,102,240,0.10)' },
  phText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: '#1366F0' },
  mailPrev: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', overflow: 'hidden' },
  mailHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(14,23,38,0.06)', backgroundColor: 'rgba(237,239,243,0.6)' },
  mailSubj: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#0E1726', flex: 1 },
  mailBody: { fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 20, color: '#0E1726', padding: 14 },
  fieldRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  helpText: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18, color: '#8A93A0' },
  envNote: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: '#1E9E5A', marginBottom: 14 },
  connText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: '#5A6573' },
  gBox: { padding: 14, borderRadius: 14, backgroundColor: 'rgba(19,102,240,0.06)', borderWidth: 1, borderColor: 'rgba(19,102,240,0.14)', marginBottom: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7 },
  switch: { width: 40, height: 24, borderRadius: 12, backgroundColor: 'rgba(14,23,38,0.14)', padding: 3 },
  switchOn: { backgroundColor: '#1E9E5A' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  knobOn: { transform: [{ translateX: 16 }] },
  toggleText: { fontFamily: 'Manrope_500Medium', fontSize: 13.5, color: '#0E1726' },
  toast: { position: 'absolute', right: 24, bottom: 24, maxWidth: 440, backgroundColor: '#0E1726', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24 },
  toastText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13.5, color: '#fff' },
});
