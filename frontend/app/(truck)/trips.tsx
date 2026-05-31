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

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const STATUSES = ['все', 'новая', 'забрали', 'доставлено'];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(ym: string) {
  if (!ym) return ym;
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}
function sColor(s: string) {
  if (s === 'доставлено') return theme.colors.profit;
  if (s === 'забрали') return theme.colors.warning;
  if (s === 'отменён') return theme.colors.loss;
  return theme.colors.info;
}

export default function TruckTrips() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('все');
  const [monthFilter, setMonthFilter] = useState(currentMonth());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availMonths, setAvailMonths] = useState<string[]>([]);

  const load = async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'все') params.status = statusFilter;
      if (monthFilter !== 'all') params.month = monthFilter;
      const data = await api.truck.trips.list(params) as any[];
      setTrips(data);
      // Build available months
      const ms = new Set<string>();
      data.forEach(t => {
        const ym = (t.date_loading || t.created_at || '').slice(0, 7);
        if (ym && ym.length === 7) ms.add(ym);
      });
      setAvailMonths(Array.from(ms).sort().reverse().slice(0, 12));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [statusFilter, monthFilter]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const cm = currentMonth();
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
      <View style={styles.cardTop}>
        <Text style={styles.num}>{item.trip_number}</Text>
        <Text style={[styles.status, { color: sColor(item.status) }]}>{item.status}</Text>
      </View>
      <Text style={styles.truck}>{item.truck_name || '—'} · {item.driver_name || '—'}</Text>
      {(item.date_loading || item.date_unloading) && (
        <Text style={styles.dates}>
          {(item.date_loading || '').slice(0, 10)}{item.date_unloading ? ` → ${(item.date_unloading || '').slice(0, 10)}` : ''}
        </Text>
      )}
      {/* Order previews */}
      {(item.orders_preview || []).length > 0 && (
        <View style={styles.previewRow}>
          {(item.orders_preview as any[]).slice(0, 3).map((o: any, i: number) => (
            <View key={i} style={styles.previewBadge}>
              <Text style={styles.previewText} numberOfLines={1}>
                {o.city_loading && o.city_unloading ? `${o.city_loading}→${o.city_unloading}` : o.client_name || o.order_number || '—'}
              </Text>
            </View>
          ))}
          {(item.orders_count ?? 0) > 3 && (
            <View style={styles.previewBadge}>
              <Text style={styles.previewText}>+{item.orders_count - 3}</Text>
            </View>
          )}
        </View>
      )}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.footerLabel}>Общая ставка</Text>
          <Text style={styles.footerRate}>{formatMoney(item.rate_total)}</Text>
          {(item.bonus_amount ?? 0) > 0 && <Text style={styles.bonus}>🎁 +{formatMoney(item.bonus_amount)}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.footerLabel}>Инвестору</Text>
          <Text style={[styles.footerRate, { color: theme.colors.textSecondary }]}>{formatMoney(item.rate_investor)}</Text>
          <Text style={styles.ordersCount}>{item.orders_count ?? 0} зая.</Text>
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
        <TextInput style={styles.searchInput} placeholder="Поиск..." placeholderTextColor={theme.colors.textTertiary} value={search} onChangeText={setSearch} />
      </View>

      {/* Month filter */}
      <ScrollHoriz style={{ marginBottom: 8 }}>
        {[
          { id: cm, label: `${monthLabel(cm)}` },
          ...availMonths.filter(m => m !== cm).map(m => ({ id: m, label: monthLabel(m) })),
          { id: 'all', label: 'Всё время' },
        ].map(it => {
          const a = monthFilter === it.id;
          return (
            <TouchableOpacity key={it.id} onPress={() => setMonthFilter(it.id)} style={[styles.chip, a && styles.chipActive]}>
              <Text style={[styles.chipText, a && styles.chipTextActive]}>{it.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollHoriz>

      {/* Status filter */}
      <ScrollHoriz style={{ marginBottom: 10 }}>
        {STATUSES.map(s => {
          const a = statusFilter === s;
          return (
            <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[styles.chip, a && styles.chipStatusActive]}>
              <Text style={[styles.chipText, a && styles.chipStatusTextActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollHoriz>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет рейсов</Text>}
        />
      )}
    </View>
  );
}

function ScrollHoriz({ children, style }: any) {
  const { ScrollView } = require('react-native');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      {children}
    </ScrollView>
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
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipStatusActive: { backgroundColor: theme.colors.info + '25', borderColor: theme.colors.info },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: '#000' },
  chipStatusTextActive: { color: theme.colors.info },
  card: { backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  num: { fontSize: 15, fontWeight: '700', color: theme.colors.accent, letterSpacing: 0.5 },
  status: { fontSize: 12, fontWeight: '600' },
  truck: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 2 },
  dates: { fontSize: 12, color: theme.colors.textTertiary, marginBottom: 8 },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  previewBadge: { backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 160 },
  previewText: { fontSize: 11, color: theme.colors.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 },
  footerLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase' },
  footerRate: { fontSize: 15, fontWeight: '700', color: theme.colors.accent, marginTop: 2 },
  bonus: { fontSize: 10, color: theme.colors.accentBright },
  ordersCount: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },
  empty: { textAlign: 'center', color: theme.colors.textTertiary, fontSize: 14, paddingTop: 40 },
});
