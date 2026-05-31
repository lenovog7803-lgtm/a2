import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const STATUSES = ['все', 'новая', 'в работе', 'выполнен', 'отменён'];

function statusColor(s: string) {
  switch (s) {
    case 'выполнен': return theme.colors.profit;
    case 'в работе': return theme.colors.warning;
    case 'отменён': return theme.colors.loss;
    default: return theme.colors.info;
  }
}

export default function TruckTrips() {
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);
  const [filter, setFilter] = useState('все');
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

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/truck-trip/${item.id}`)}>
      <View style={styles.cardHeader}>
        <Text style={styles.number}>{item.trip_number}</Text>
        <Text style={[styles.status, { color: statusColor(item.status) }]}>{item.status}</Text>
      </View>
      <Text style={styles.route}>{item.route || '—'}</Text>
      <Text style={styles.client}>{item.client_name || '—'}</Text>
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.rateLabel}>Ставка клиента</Text>
          <Text style={styles.rate}>{formatMoney(item.rate_client)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.rateLabel}>Аренда инвестору</Text>
          <Text style={[styles.rate, { color: theme.colors.textSecondary }]}>{formatMoney(item.rate_investor)}</Text>
          {item.bonus_amount > 0 && (
            <Text style={styles.bonus}>🎁 +{formatMoney(item.bonus_amount)}</Text>
          )}
        </View>
      </View>
      <View style={styles.payRow}>
        <PayBadge label="Клиент" status={item.payment_client_status} />
        <PayBadge label="Инвестор" status={item.payment_investor_status} />
        {!item.documents_sent_client && (
          <View style={styles.docBadge}>
            <Text style={styles.docBadgeText}>📄 нет документов</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Рейсы</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/truck-trip/new')}>
          <Plus size={20} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {STATUSES.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, filter === s && styles.filterBtnActive]}
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
          data={trips}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет рейсов</Text>}
        />
      )}
    </View>
  );
}

function PayBadge({ label, status }: { label: string; status: string }) {
  const color = status === 'оплачен' || status === 'выплачено' ? theme.colors.profit
    : status === 'частично' ? theme.colors.warning : theme.colors.textTertiary;
  return (
    <View style={[styles.payBadge, { borderColor: color }]}>
      <Text style={[styles.payBadgeText, { color }]}>{label}: {status || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary },
  addBtn: {
    backgroundColor: theme.colors.accent, borderRadius: 10,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 6, flexWrap: 'wrap' },
  filterBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  filterBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  filterText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: '#000' },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  number: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  status: { fontSize: 12, fontWeight: '600' },
  route: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 2 },
  client: { fontSize: 12, color: theme.colors.textTertiary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rateLabel: { fontSize: 10, color: theme.colors.textTertiary, fontWeight: '600' },
  rate: { fontSize: 15, fontWeight: '700', color: theme.colors.accent, marginTop: 2 },
  bonus: { fontSize: 11, color: theme.colors.accentBright, marginTop: 1 },
  payRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  payBadgeText: { fontSize: 10, fontWeight: '600' },
  docBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(245,158,11,0.15)' },
  docBadgeText: { fontSize: 10, fontWeight: '600', color: theme.colors.warning },
  empty: { textAlign: 'center', color: theme.colors.textTertiary, fontSize: 14, paddingTop: 40 },
});
