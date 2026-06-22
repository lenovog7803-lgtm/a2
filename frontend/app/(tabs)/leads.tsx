import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, TextInput, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Phone, Mail, Clock, Building2, Search, RefreshCw, ChevronDown, Check, X } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import { ClientModal } from '../../src/components/ClientModal';

const statusStats = [
  { label: 'Новые',         key: 'new',      color: '#2563EB' },
  { label: 'Думают',        key: 'thinking', color: '#F59E0B' },
  { label: 'КП отправлено', key: 'sent_kp',  color: '#8B5CF6' },
  { label: 'Перезвонить',   key: 'callback', color: '#EF4444' },
  { label: 'Клиенты',       key: 'won',      color: '#10B981' },
  { label: 'Отказ',         key: 'lost',     color: '#9CA3AF' },
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

  const ListHeader = () => (
    <>
      {/* Статистика */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row' }}>
        {statusStats.map((s) => {
          const count = leads.filter(l => l.status === s.key).length;
          const isActive = filterStatus === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setFilterStatus(isActive ? null : s.key)}
              style={{ backgroundColor: isActive ? s.color + '15' : theme.colors.surface, borderRadius: 12, padding: 12, minWidth: 90, alignItems: 'center', borderWidth: 0.5, borderColor: isActive ? s.color + '40' : theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 9, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{s.label}</Text>
              <Text style={{ fontSize: 22, fontWeight: '700', color: s.color, letterSpacing: -0.5 }}>{count}</Text>
              <View style={{ height: 2.5, width: 32, borderRadius: 2, backgroundColor: s.color, marginTop: 6, opacity: isActive ? 1 : 0.3 }} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Перезвонить сейчас */}
      {urgentLeads.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 10 }}>Перезвонить сейчас</Text>
          {urgentLeads.slice(0, 3).map(lead => (
            <UrgentLeadCard key={lead.id} lead={lead} onPress={() => router.push(`/lead/${lead.id}`)} />
          ))}
        </View>
      )}

      {filtered.length > 0 && (
        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textTertiary, paddingHorizontal: 16, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {filterStatus ? statusStats.find(s => s.key === filterStatus)?.label : 'Все'} · {filtered.length}
        </Text>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Шапка */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 8, paddingBottom: 14, backgroundColor: theme.colors.surface, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: -0.8 }}>Команда</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 }}>Дашборд обзвона</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity onPress={syncAndReload} disabled={syncing} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.bg, borderWidth: 0.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
              {syncing ? <ActivityIndicator size="small" color={theme.colors.textSecondary} /> : <RefreshCw size={15} color={theme.colors.textSecondary} strokeWidth={1.8} />}
            </TouchableOpacity>
            <TouchableOpacity testID="add-lead-btn" onPress={() => router.push('/lead/new')} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.8}>
              <Plus size={18} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Поиск */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: theme.colors.border }}>
          <Search size={14} color={theme.colors.textTertiary} strokeWidth={1.5} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Поиск компании или контакта..."
            placeholderTextColor={theme.colors.textTertiary}
            style={{ flex: 1, fontSize: 13, color: theme.colors.textPrimary }}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
          ListHeaderComponent={<ListHeader />}
          renderItem={({ item, index }) => (
            <LeadCard
              lead={item}
              onPress={() => router.push(`/lead/${item.id}`)}
              onAction={(s: string) => setStatus(item.id, s)}
              testID={`lead-card-${index}`}
            />
          )}
          ListEmptyComponent={<Text style={{ color: theme.colors.textTertiary, textAlign: 'center', marginTop: 40, fontSize: 14 }}>Нет контактов для обзвона</Text>}
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

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: isOverdue ? '#FECACA' : theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: isOverdue ? '#FEE2E2' : theme.colors.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Building2 size={18} color={isOverdue ? '#EF4444' : theme.colors.accent} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }} numberOfLines={1}>{lead.name}</Text>
        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 }} numberOfLines={1}>
          {lead.phone}{lead.city ? ' • ' + lead.city : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Clock size={10} color={isOverdue ? '#EF4444' : '#F59E0B'} strokeWidth={2} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: isOverdue ? '#EF4444' : '#F59E0B' }}>{timeLabel}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {!!lead.email && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`mailto:${lead.email}`); }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.colors.border }}
          >
            <Mail size={15} color={theme.colors.textSecondary} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`tel:${lead.phone}`); }}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Phone size={15} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function LeadCard({ lead, onPress, onAction, testID }: any) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    new:      { label: 'Новый',         color: '#2563EB', bg: '#EFF6FF' },
    thinking: { label: 'Думает',        color: '#F59E0B', bg: '#FFFBEB' },
    sent_kp:  { label: 'КП отправлено', color: '#8B5CF6', bg: '#F5F3FF' },
    callback: { label: 'Перезвонить',   color: '#EF4444', bg: '#FEF2F2' },
    won:      { label: 'Клиент',        color: '#10B981', bg: '#ECFDF5' },
    lost:     { label: 'Отказ',         color: '#9CA3AF', bg: '#F9FAFB' },
  };
  const s = statusConfig[lead.status] || statusConfig.new;
  const isOverdue = lead.next_call && new Date(lead.next_call) < new Date();

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.78}
      style={{ backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: isOverdue ? '#FECACA' : theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }} numberOfLines={1}>{lead.name}</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
            {lead.phone}{lead.city ? ' • ' + lead.city : ''}
          </Text>
        </View>
        <View style={{ backgroundColor: s.bg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: s.color }}>{s.label}</Text>
        </View>
      </View>

      {(lead.industry || lead.contact_person) && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {lead.industry && (
            <View style={{ backgroundColor: theme.colors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: theme.colors.border }}>
              <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>{lead.industry}</Text>
            </View>
          )}
          {lead.contact_person && (
            <View style={{ backgroundColor: theme.colors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: theme.colors.border }}>
              <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>{lead.contact_person}</Text>
            </View>
          )}
        </View>
      )}

      {lead.next_call && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
          <Clock size={11} color={isOverdue ? '#EF4444' : theme.colors.textTertiary} strokeWidth={2} />
          <Text style={{ fontSize: 11, color: isOverdue ? '#EF4444' : theme.colors.textTertiary, fontWeight: isOverdue ? '600' : '400' }}>
            {isOverdue ? 'Просрочено: ' : 'Перезвонить: '}
            {new Date(lead.next_call).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
      )}

      {lead.last_call_note && (
        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 6, fontStyle: 'italic' }} numberOfLines={2}>
          "{lead.last_call_note}"
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  industryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginTop: 10 },
  industryBtnActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + '15' },
  industryBtnText: { color: theme.colors.textTertiary, fontSize: 14, flex: 1, marginRight: 8 },
  industryBtnTextActive: { color: theme.colors.accent },
  industryBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  industrySheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 20 },
  industrySheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  industrySheetTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  industryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  industryItemActive: { backgroundColor: theme.colors.accent + '10' },
  industryItemText: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '500' },
});
