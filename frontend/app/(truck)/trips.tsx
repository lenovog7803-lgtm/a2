import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const STATUSES = ['все', 'новая', 'забрали', 'доставлено', 'отменён'];

function sColor(s: string) {
  switch (s) {
    case 'доставлено': return theme.colors.profit;
    case 'забрали': return theme.colors.warning;
    case 'отменён': return theme.colors.loss;
    default: return theme.colors.info;
  }
}

export default function TruckTrips() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<any[]>([]);
  const [filter, setFilter] = useState('все');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.truck.trips.list(filter !== 'все' ? { status: filter } : undefined) as any[];
      setTrips(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [filter]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? trips.filter(t =>
        (t.trip_number || '').toLowerCase().includes(q) ||
        (t.truck_name || '').toLowerCase().includes(q) ||
        (t.driver_name || '').toLowerCase().includes(q)
      )
    : trips;

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/truck-trip/${item.id}`)}>
      <View style={styles.cardHeader}>
        <Text style={styles.number}>{item.trip_number}</Text>
        <Text style={[styles.status, { color: sColor(item.status) }]}>{item.status}</Text>
      </View>
      <Text style={styles.truckLine}>{item.truck_name || '—'} · {item.driver_name || '—'}</Text>
      {item.date_loading && <Text style={styles.dateLine}>{item.date_loading?.slice(0, 10)}{item.date_unloading ? ' → ' + item.date_unloading?.slice(0, 10) : ''}</Text>}
      <View style={styles.routesRow}>
        {(item.routes_preview || []).slice(0, 2).map((r: any, i: number) => (
          <View key={i} style={styles.routeBadge}>
            <Text style={styles.routeBadgeText} numberOfLines={1}>{r.route || r.client_name || '—'}</Text>
          </View>
        ))}
        {(item.routes_count ?? 0) > 2 && (
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>+{item.routes_count - 2}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.rateLabel}>Ставка итого</Text>
          <Text style={styles.rate}>{formatMoney(item.rate_total)}</Text>
          {(item.bonus_amount ?? 0) > 0 && (
            <Text style={styles.bonus}>🎁 бонус +{formatMoney(item.bonus_amount)}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.rateLabel}>Инвестору</Text>
          <Text style={[styles.rate, { color: theme.colors.textSecondary }]}>{formatMoney(item.rate_investor)}</Text>
          <PayBadge status={item.payment_investor_status} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>РЕЙСЫ</Text>
          <Text style={styles.title}>Рейсы</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/truck-trip/new')}>
          <Plus size={20} color="#000" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по номеру, машине, водителю"
          placeholderTextColor={theme.colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {STATUSES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, filter === s && styles.filterChipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет рейсов</Text>}
        />
      )}
    </View>
  );
}

function PayBadge({ status }: { status?: string }) {
  const color = status === 'выплачено' ? theme.colors.profit : theme.colors.textTertiary;
  return (
    <View style={[styles.payBadge, { borderColor: color }]}>
      <Text style={[styles.payBadgeText, { color }]}>{status || 'не выплачено'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 10 },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  filterChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  filterText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: '#000' },
  card: { backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  number: { fontSize: 13, fontWeight: '700', color: theme.colors.accent, letterSpacing: 0.5 },
  status: { fontSize: 12, fontWeight: '600' },
  truckLine: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 2 },
  dateLine: { fontSize: 12, color: theme.colors.textTertiary, marginBottom: 6 },
  routesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  routeBadge: { backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 160 },
  routeBadgeText: { fontSize: 11, color: theme.colors.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 },
  rateLabel: { fontSize: 10, color: theme.colors.textTertiary, fontWeight: '700', textTransform: 'uppercase' },
  rate: { fontSize: 15, fontWeight: '700', color: theme.colors.accent, marginTop: 2 },
  bonus: { fontSize: 10, color: theme.colors.accentBright },
  payBadge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  payBadgeText: { fontSize: 10, fontWeight: '600' },
  empty: { textAlign: 'center', color: theme.colors.textTertiary, fontSize: 14, paddingTop: 40 },
});
