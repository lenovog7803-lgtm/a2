import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, TextInput, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Phone, Mail, Clock, Building2, Search, RefreshCw, ChevronDown, Check, X } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { ClientModal } from '../../src/components/ClientModal';

const GRADIENTS_AV: [string, string][] = [
  ['#A5D8FF', '#1366F0'], ['#D0BFFF', '#7C3AED'], ['#A7F3D0', '#1E9E5A'],
  ['#FCD34D', '#D97706'], ['#FCA5A5', '#E0473B'], ['#BAE6FD', '#0891B2'],
];
function avIdx(name: string) { return (name?.charCodeAt(0) || 0) % GRADIENTS_AV.length; }
function avMono(name: string) { return (name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(); }

const CARD_SHADOW = { shadowColor: '#0E1726', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 };

const statusStats = [
  { label: 'Новые',         key: 'new',      color: '#1366F0',  bg: 'rgba(19,102,240,0.12)' },
  { label: 'Думают',        key: 'thinking', color: '#D97706',  bg: 'rgba(217,119,6,0.12)' },
  { label: 'КП',            key: 'sent_kp',  color: '#7C3AED',  bg: 'rgba(124,58,237,0.12)' },
  { label: 'Перезвон',      key: 'callback', color: '#E0473B',  bg: 'rgba(224,71,59,0.12)' },
  { label: 'Клиенты',       key: 'won',      color: '#1E9E5A',  bg: 'rgba(30,158,90,0.12)' },
  { label: 'Отказ',         key: 'lost',     color: '#8A93A0',  bg: 'rgba(14,23,38,0.06)' },
];

export default function Leads() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [industries, setIndustries] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState('');
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false);
  const industryRef = useRef('');
  const [clientModalLead, setClientModalLead] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [l, inds] = await Promise.all([
        api.leads.list(industryRef.current || undefined),
        api.leads.industries().catch(() => [] as string[]),
      ]);
      setLeads(l);
      setIndustries(inds);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleIndustryChange = useCallback((val: string) => {
    industryRef.current = val;
    setIndustryFilter(val);
    setLoading(true);
    api.leads.list(val || undefined).then(l => {
      setLeads(l);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const syncAndReload = useCallback(async () => {
    setSyncing(true);
    try {
      await api.sync.importFromSheets();
      await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    if (status === 'won') {
      const lead = leads.find(l => l.id === id);
      setClientModalLead(lead);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const prevLeads = leads;
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status, last_contact: today } : l));
    try {
      const updated = await api.leads.update(id, { status, last_contact: today });
      setLeads(prev => prev.map(l => l.id === id ? updated : l));
    } catch (e: any) {
      setLeads(prevLeads);
      Alert.alert('Ошибка', e.message);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = (filterStatus === null ? leads : leads.filter(l => l.status === filterStatus))
    .filter(l => !q ||
      (l.name || '').toLowerCase().includes(q) ||
      (l.company || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q) ||
      (l.city || '').toLowerCase().includes(q)
    );

  const urgentLeads = leads.filter(l => {
    if (!l.next_call) return false;
    return new Date(l.next_call).getTime() - Date.now() < 60 * 60 * 1000;
  }).sort((a, b) => new Date(a.next_call).getTime() - new Date(b.next_call).getTime());

  const totalLeads = leads.length;
  const funnelSteps = statusStats.map(s => ({ ...s, cnt: leads.filter(l => l.status === s.key).length }));
  const maxFunnel = Math.max(...funnelSteps.map(f => f.cnt), 1);

  const ListHeader = () => (
    <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
      {/* Stats strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        {funnelSteps.slice(0, 4).map((s) => {
          const isActive = filterStatus === s.key;
          return (
            <TouchableOpacity key={s.key} onPress={() => setFilterStatus(isActive ? null : s.key)} activeOpacity={0.85}
              style={{ backgroundColor: isActive ? s.bg : '#fff', borderRadius: 20, padding: 16, minWidth: 100, borderWidth: 1, borderColor: isActive ? 'transparent' : 'rgba(14,23,38,0.07)', ...CARD_SHADOW }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: isActive ? s.color : s.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: isActive ? '#fff' : s.color }} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#0E1726', letterSpacing: -0.5 }}>{s.cnt}</Text>
              <Text style={{ fontSize: 12, color: '#8A93A0', fontWeight: '500', marginTop: 3 }}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
        {/* Funnel card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, minWidth: 180, borderWidth: 1, borderColor: 'rgba(14,23,38,0.07)', ...CARD_SHADOW }}>
          <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.08, color: '#A6AEB8', marginBottom: 10 }}>ВОРОНКА</Text>
          {funnelSteps.slice(0, 5).map(f => (
            <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <Text style={{ width: 68, fontSize: 11.5, color: '#5A6573', fontWeight: '500' }}>{f.label}</Text>
              <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(14,23,38,0.05)', overflow: 'hidden' }}>
                <View style={{ width: `${(f.cnt / maxFunnel) * 100}%` as any, height: '100%', borderRadius: 6, backgroundColor: f.color }} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0E1726', minWidth: 18, textAlign: 'right' }}>{f.cnt}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Перезвонить сейчас */}
      {urgentLeads.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0E1726', marginBottom: 10, letterSpacing: -0.3 }}>Перезвонить сейчас</Text>
          {urgentLeads.slice(0, 3).map(lead => (
            <UrgentLeadCard key={lead.id} lead={lead} onPress={() => router.push(`/lead/${lead.id}`)} />
          ))}
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => setFilterStatus(null)} activeOpacity={0.85}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11, backgroundColor: filterStatus === null ? '#0E1726' : '#fff', borderWidth: 1, borderColor: filterStatus === null ? 'transparent' : 'rgba(14,23,38,0.08)' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: filterStatus === null ? '#fff' : '#5A6573' }}>Все {totalLeads}</Text>
        </TouchableOpacity>
        {funnelSteps.map(s => {
          const isActive = filterStatus === s.key;
          return (
            <TouchableOpacity key={s.key} onPress={() => setFilterStatus(isActive ? null : s.key)} activeOpacity={0.85}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11, backgroundColor: isActive ? s.bg : '#fff', borderWidth: 1, borderColor: isActive ? 'transparent' : 'rgba(14,23,38,0.08)' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? s.color : '#5A6573' }}>{s.label} {s.cnt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : theme.colors.bg }}>
      {/* Шапка */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14, backgroundColor: theme.colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#0E1726', letterSpacing: -0.8 }}>Обзвон</Text>
            <Text style={{ fontSize: 12.5, color: '#8A93A0', marginTop: 2, fontWeight: '500' }}>
              Всего: <Text style={{ fontWeight: '700', color: '#0E1726' }}>{leads.length}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity onPress={syncAndReload} disabled={syncing} style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
              {syncing ? <ActivityIndicator size="small" color="#5A6573" /> : <RefreshCw size={16} color="#5A6573" strokeWidth={1.7} />}
            </TouchableOpacity>
            <TouchableOpacity testID="add-lead-btn" onPress={() => router.push('/lead/new')} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0E1726', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 }}>
              <Plus size={15} color="#fff" strokeWidth={2.2} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Добавить</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Поиск */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', shadowColor: '#0E1726', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 }}>
          <Search size={15} color="#8A93A0" strokeWidth={1.6} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Поиск компании или контакта..."
            placeholderTextColor="#8A93A0"
            style={{ flex: 1, fontSize: 13.5, color: '#0E1726' }}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Фильтр по отрасли */}
        {Platform.OS === 'web' ? (
          <View style={{ marginTop: 10 }}>
            {/* @ts-ignore */}
            <select
              value={industryFilter}
              onChange={(e: any) => handleIndustryChange(e.target.value)}
              style={{ backgroundColor: 'transparent', color: industryFilter ? theme.colors.accent : theme.colors.textTertiary, border: `1px solid ${industryFilter ? theme.colors.accent : theme.colors.border}`, borderRadius: 12, padding: '9px 14px', fontSize: 14, width: '100%', cursor: 'pointer', outline: 'none' }}
            >
              <option value="">Все отрасли</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={() => setIndustryPickerOpen(true)} style={[styles.industryBtn, !!industryFilter && styles.industryBtnActive]} activeOpacity={0.7}>
              <Text style={[styles.industryBtnText, !!industryFilter && styles.industryBtnTextActive]} numberOfLines={1}>
                {industryFilter || 'Все отрасли'}
              </Text>
              <ChevronDown size={14} color={industryFilter ? theme.colors.accent : theme.colors.textTertiary} strokeWidth={1.8} />
            </TouchableOpacity>

            <Modal visible={industryPickerOpen} transparent animationType="fade" onRequestClose={() => setIndustryPickerOpen(false)}>
              <TouchableOpacity style={styles.industryBackdrop} activeOpacity={1} onPress={() => setIndustryPickerOpen(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.industrySheet} onPress={() => {}}>
                  <View style={styles.industrySheetHead}>
                    <Text style={styles.industrySheetTitle}>Отрасль</Text>
                    <TouchableOpacity onPress={() => setIndustryPickerOpen(false)}>
                      <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={[{ id: '', label: 'Все отрасли' }, ...industries.map(i => ({ id: i, label: i }))]}
                    keyExtractor={(i) => i.id || '__all__'}
                    renderItem={({ item }) => {
                      const active = item.id === industryFilter;
                      return (
                        <TouchableOpacity
                          style={[styles.industryItem, active && styles.industryItemActive]}
                          onPress={() => { handleIndustryChange(item.id); setIndustryPickerOpen(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.industryItemText, active && { color: theme.colors.accent }]}>{item.label}</Text>
                          {active && <Check size={16} color={theme.colors.accent} strokeWidth={2} />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          testID="leads-list"
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 14, gap: 12 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100, gap: 12 }}
          ListHeaderComponent={<ListHeader />}
          renderItem={({ item, index }) => (
            <LeadCard
              lead={item}
              onPress={() => router.push(`/lead/${item.id}`)}
              onAction={(s: string) => setStatus(item.id, s)}
              testID={`lead-card-${index}`}
            />
          )}
          ListEmptyComponent={<Text style={{ color: '#8A93A0', textAlign: 'center', marginTop: 40, fontSize: 14 }}>Нет контактов для обзвона</Text>}
        />
      )}

      {clientModalLead && (
        <ClientModal
          visible={!!clientModalLead}
          lead={clientModalLead}
          onClose={() => setClientModalLead(null)}
          onSuccess={() => { setClientModalLead(null); load(); }}
        />
      )}
    </View>
  );
}

function UrgentLeadCard({ lead, onPress }: any) {
  const isOverdue = lead.next_call && new Date(lead.next_call) < new Date();
  const diff = Math.abs(Date.now() - new Date(lead.next_call).getTime());
  const timeLabel = isOverdue
    ? 'Просрочено на ' + Math.round(diff / 3600000) + 'ч'
    : 'Через ' + Math.round(diff / 60000) + ' мин';
  const idx = avIdx(lead.name || '');
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: isOverdue ? 'rgba(224,71,59,0.2)' : 'rgba(14,23,38,0.07)', ...CARD_SHADOW }}>
      <LinearGradient colors={GRADIENTS_AV[idx]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{avMono(lead.name)}</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#0E1726' }} numberOfLines={1}>{lead.name}</Text>
        <Text style={{ fontSize: 11, color: '#8A93A0', marginTop: 1 }} numberOfLines={1}>{lead.phone}{lead.city ? ' · ' + lead.city : ''}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Clock size={11} color={isOverdue ? '#E0473B' : '#D97706'} strokeWidth={2} />
          <Text style={{ fontSize: 10.5, fontWeight: '600', color: isOverdue ? '#E0473B' : '#D97706' }}>{timeLabel}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={(e) => { (e as any).stopPropagation?.(); Linking.openURL(`tel:${lead.phone}`); }}
        style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#0E1726', alignItems: 'center', justifyContent: 'center' }}>
        <Phone size={15} color="#fff" strokeWidth={2} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function LeadCard({ lead, onPress, onAction, testID }: any) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    new:      { label: 'Новый',    color: '#1366F0', bg: 'rgba(19,102,240,0.12)' },
    thinking: { label: 'Думает',   color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
    sent_kp:  { label: 'КП',       color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
    callback: { label: 'Перезвон', color: '#E0473B', bg: 'rgba(224,71,59,0.12)' },
    won:      { label: 'Клиент',   color: '#1E9E5A', bg: 'rgba(30,158,90,0.12)' },
    lost:     { label: 'Отказ',    color: '#8A93A0', bg: 'rgba(14,23,38,0.06)' },
  };
  const s = statusConfig[lead.status] || statusConfig.new;
  const isOverdue = lead.next_call && new Date(lead.next_call) < new Date();
  const idx = avIdx(lead.name || '');
  const mono = avMono(lead.name || '');

  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.88}
      style={{ flex: 1, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: isOverdue ? 'rgba(224,71,59,0.2)' : 'rgba(14,23,38,0.07)', ...CARD_SHADOW }}>

      {/* Avatar + name + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <LinearGradient colors={GRADIENTS_AV[idx]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{mono}</Text>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0E1726' }} numberOfLines={1}>{lead.name}</Text>
          <Text style={{ fontSize: 11.5, color: '#8A93A0', marginTop: 2 }} numberOfLines={1}>{lead.company || lead.city || '—'}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ backgroundColor: s.bg, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: s.color }}>{s.label}</Text>
        </View>
        {lead.next_call && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Clock size={12} color={isOverdue ? '#E0473B' : '#D97706'} strokeWidth={2} />
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: isOverdue ? '#E0473B' : '#D97706' }}>
              {new Date(lead.next_call).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        )}
      </View>

      {lead.last_call_note && (
        <Text style={{ fontSize: 12, color: '#5A6573', lineHeight: 17, marginBottom: 12 }} numberOfLines={2}>{lead.last_call_note}</Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(14,23,38,0.06)' }}>
        <TouchableOpacity onPress={(e) => { (e as any).stopPropagation?.(); Linking.openURL(`tel:${lead.phone}`); }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#0E1726', alignItems: 'center', justifyContent: 'center' }}>
          <Phone size={15} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        {lead.status !== 'won' && lead.status !== 'lost' && (
          <TouchableOpacity onPress={(e) => { (e as any).stopPropagation?.(); onAction('won'); }}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(30,158,90,0.12)' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E9E5A' }}>Стал клиентом</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  industryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  industryBtnActive: { borderColor: '#1366F0', backgroundColor: 'rgba(19,102,240,0.08)' },
  industryBtnText: { color: '#8A93A0', fontSize: 14, flex: 1, marginRight: 8 },
  industryBtnTextActive: { color: '#1366F0' },
  industryBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  industrySheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingBottom: 20 },
  industrySheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(14,23,38,0.07)' },
  industrySheetTitle: { color: '#0E1726', fontSize: 16, fontWeight: '700' },
  industryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(14,23,38,0.06)' },
  industryItemActive: { backgroundColor: 'rgba(19,102,240,0.07)' },
  industryItemText: { color: '#0E1726', fontSize: 15, fontWeight: '500' },
});
