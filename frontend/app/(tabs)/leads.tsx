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
