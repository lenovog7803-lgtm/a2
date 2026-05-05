import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Phone, Calendar, Check, Search, RefreshCw } from 'lucide-react-native';
import { theme, leadStatusLabels, leadStatusColors } from '../../src/theme';
import { api } from '../../src/api';
import { Badge } from '../../src/components/Badge';
import { ClientModal } from '../../src/components/ClientModal';

export default function Leads() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const l = await api.leads.list();
      setLeads(l);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const syncAndReload = useCallback(async () => {
    setSyncing(true);
    try {
      await api.sync.importFromSheets();
      await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = (filter === 'all' ? leads : leads.filter(l => l.status === filter))
    .filter(l => !q ||
      (l.name || '').toLowerCase().includes(q) ||
      (l.company || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q) ||
      (l.city || '').toLowerCase().includes(q)
    );

  const filters = [
    { id: 'all', label: 'Все', count: leads.length },
    { id: 'new', label: 'Новые', count: leads.filter(l => l.status === 'new').length },
    { id: 'in_progress', label: 'В работе', count: leads.filter(l => l.status === 'in_progress').length },
    { id: 'callback', label: 'Перезвонить', count: leads.filter(l => l.status === 'callback').length },
    { id: 'won', label: 'Клиенты', count: leads.filter(l => l.status === 'won').length },
  ];

  const [clientModalLead, setClientModalLead] = useState<any>(null);

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
      await api.leads.update(id, { status, last_contact: today });
    } catch (e: any) {
      setLeads(prevLeads);
      Alert.alert('Ошибка', e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top + 16 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>ПРОДАЖИ</Text>
            <Text style={styles.title}>Обзвон</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={syncAndReload} disabled={syncing} style={styles.syncBtn} activeOpacity={0.7}>
              {syncing
                ? <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                : <RefreshCw size={16} color={theme.colors.textSecondary} strokeWidth={1.8} />}
            </TouchableOpacity>
            <TouchableOpacity testID="add-lead-btn" onPress={() => router.push('/lead/new')} style={styles.fab} activeOpacity={0.8}>
              <Plus size={20} color="#000" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по имени, компании, телефону, городу"
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          horizontal
          data={filters}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 16 }}
          renderItem={({ item }) => {
            const active = filter === item.id;
            return (
              <TouchableOpacity
                onPress={() => setFilter(item.id)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                <Text style={[styles.chipCount, active && styles.chipCountActive]}>{item.count}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          testID="leads-list"
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={<LeadsStats leads={leads} />}
          renderItem={({ item, index }) => (
            <LeadCard
              lead={item}
              onPress={() => router.push(`/lead/${item.id}`)}
              onAction={(s: string) => setStatus(item.id, s)}
              testID={`lead-card-${index}`}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>Нет контактов для обзвона</Text>}
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

// ─── Stats block ────────────────────────────────────────────────────────────

function LeadsStats({ leads }: { leads: any[] }) {
  const total = leads.length;
  if (total === 0) return null;

  const cnt = (status: string) => leads.filter(l => l.status === status).length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const funnel = [
    { label: 'Новые',       status: 'new',         color: leadStatusColors['new'] },
    { label: 'В работе',    status: 'in_progress',  color: leadStatusColors['in_progress'] },
    { label: 'Перезвонить', status: 'callback',     color: leadStatusColors['callback'] },
    { label: 'Клиенты',    status: 'won',           color: leadStatusColors['won'] },
    { label: 'Потеряны',   status: 'lost',          color: leadStatusColors['lost'] },
  ].map(f => ({ ...f, count: cnt(f.status), pct: pct(cnt(f.status)) }));

  const wonCount = cnt('won');
  const processed = leads.filter(l => l.status !== 'new').length;
  const convRate = pct(wonCount);

  // Last 7 days activity by last_contact
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6 + i);
    return d.toISOString().slice(0, 10);
  });
  const activity = last7.map(date => ({
    date,
    count: leads.filter(l => l.last_contact === date).length,
    day: parseInt(date.slice(8, 10), 10),
  }));
  const maxAct = Math.max(...activity.map(a => a.count), 1);

  return (
    <View style={sStyles.block}>
      {/* Funnel */}
      <Text style={sStyles.sectionLabel}>ВОРОНКА КОНВЕРСИИ</Text>
      <View style={sStyles.funnelCard}>
        {funnel.map((f, i) => (
          <React.Fragment key={f.status}>
            <View style={sStyles.funnelStep}>
              <Text style={[sStyles.funnelCount, { color: f.color || theme.colors.textTertiary }]}>{f.count}</Text>
              <Text style={sStyles.funnelLabel} numberOfLines={1}>{f.label}</Text>
              <Text style={sStyles.funnelPct}>{f.pct}%</Text>
            </View>
            {i < funnel.length - 1 && (
              <Text style={sStyles.funnelArrow}>›</Text>
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Mini-cards */}
      <View style={sStyles.cardsRow}>
        <View style={sStyles.miniCard}>
          <Text style={sStyles.miniLabel}>КОНВЕРСИЯ</Text>
          <Text style={[sStyles.miniValue, { color: theme.colors.profit }]}>{convRate}%</Text>
          <Text style={sStyles.miniSub}>в клиенты</Text>
        </View>
        <View style={sStyles.miniCard}>
          <Text style={sStyles.miniLabel}>ОБРАБОТАНО</Text>
          <Text style={[sStyles.miniValue, { color: theme.colors.accent }]}>{processed}</Text>
          <Text style={sStyles.miniSub}>контактов</Text>
        </View>
      </View>

      {/* Activity */}
      <Text style={sStyles.sectionLabel}>АКТИВНОСТЬ — 7 ДНЕЙ</Text>
      <View style={sStyles.actCard}>
        {activity.map(({ date, count, day }, i) => (
          <View
            key={date}
            style={[sStyles.actCol, i < activity.length - 1 && sStyles.actColBorder]}
          >
            <Text style={[sStyles.actNum, { color: count > 0 ? theme.colors.accent : theme.colors.textTertiary }]}>
              {count}
            </Text>
            <Text style={sStyles.actDate}>{day}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const sStyles = StyleSheet.create({
  block: { paddingBottom: 16 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.8,
    color: theme.colors.textTertiary, marginBottom: 8,
  },

  // Funnel
  funnelCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    marginBottom: 10,
  },
  funnelStep: { flex: 1, alignItems: 'center' },
  funnelCount: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  funnelLabel: { fontSize: 9, color: theme.colors.textSecondary, fontWeight: '500', marginTop: 2, textAlign: 'center' },
  funnelPct: { fontSize: 9, color: theme.colors.textTertiary, marginTop: 1 },
  funnelArrow: { color: theme.colors.textTertiary, fontSize: 16, paddingHorizontal: 2, marginBottom: 12 },

  // Mini-cards
  cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  miniCard: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12,
  },
  miniLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary },
  miniValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  miniSub: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 1 },

  // Activity
  actCard: {
    flexDirection: 'row',
    height: 80,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, marginBottom: 16, overflow: 'hidden',
  },
  actCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actColBorder: { borderRightWidth: 1, borderRightColor: theme.colors.border },
  actNum: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  actDate: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },
});

// ─── Lead card ───────────────────────────────────────────────────────────────

function LeadCard({ lead, onPress, onAction, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
          {!!lead.company && <Text style={styles.company} numberOfLines={1}>{lead.company}{lead.city ? ` · ${lead.city}` : ''}</Text>}
        </View>
        <Badge label={leadStatusLabels[lead.status] || lead.status} color={leadStatusColors[lead.status] || theme.colors.textTertiary} />
      </View>

      {!!lead.notes && <Text style={styles.notes} numberOfLines={2}>{lead.notes}</Text>}

      <View style={styles.metaRow}>
        {!!lead.next_call && (
          <View style={styles.metaItem}>
            <Calendar size={12} color={theme.colors.warning} strokeWidth={1.6} />
            <Text style={[styles.metaText, { color: theme.colors.warning }]}>Перезвонить: {lead.next_call}</Text>
          </View>
        )}
        {!!lead.last_contact && (
          <View style={styles.metaItem}>
            <Check size={12} color={theme.colors.profit} strokeWidth={1.8} />
            <Text style={styles.metaText}>Контакт: {lead.last_contact}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={(e) => { e.stopPropagation?.(); Linking.openURL(`tel:${lead.phone}`); }}
          activeOpacity={0.7}
        >
          <Phone size={14} color="#000" strokeWidth={2} />
          <Text style={styles.callBtnText}>{lead.phone}</Text>
        </TouchableOpacity>
        {lead.status !== 'won' && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={(e) => { e.stopPropagation?.(); onAction('won'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>Стал клиентом</Text>
          </TouchableOpacity>
        )}
        {lead.status !== 'in_progress' && lead.status !== 'won' && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={(e) => { e.stopPropagation?.(); onAction('in_progress'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>В работу</Text>
          </TouchableOpacity>
        )}
        {lead.status !== 'callback' && lead.status !== 'won' && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={(e) => { e.stopPropagation?.(); onAction('callback'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>Перезвонить</Text>
          </TouchableOpacity>
        )}
        {lead.status !== 'lost' && lead.status !== 'won' && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={(e) => { e.stopPropagation?.(); onAction('lost'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>Потерян</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  syncBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: theme.colors.accent },
  chipCount: { color: theme.colors.textTertiary, fontSize: 11, fontWeight: '700', backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  chipCountActive: { color: theme.colors.accent, backgroundColor: theme.colors.accent + '20' },

  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  name: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  company: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  notes: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: theme.colors.textTertiary, fontSize: 11, fontWeight: '500' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.colors.accent, borderRadius: 8,
  },
  callBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  secondaryBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.colors.surfaceElevated, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  secondaryText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600' },

  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
});
