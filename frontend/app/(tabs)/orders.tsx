import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, ArrowRight, MapPin, Calendar, AlertTriangle, Filter as FilterIcon, RefreshCw, Search } from 'lucide-react-native';
import { theme, formatMoney, statusLabels, statusColors } from '../../src/theme';
import { api } from '../../src/api';
import { Badge } from '../../src/components/Badge';
import { Picker } from '../../src/components/Picker';

const PAY_FILTER = [
  { id: 'any', label: 'Любая оплата' },
  { id: 'unpaid_client', label: 'Клиент не оплатил' },
  { id: 'unpaid_carrier', label: 'Перевозчик не оплачен' },
  { id: 'overdue', label: 'Просрочка > 15 дней' },
  { id: 'all_paid', label: 'Полностью оплачено' },
];

const DOC_FILTER = [
  { id: 'any', label: 'Любые документы' },
  { id: 'to_client_pending', label: 'Документы клиенту: не отправлены' },
  { id: 'from_client_pending', label: 'Документы от клиента: не получены' },
  { id: 'to_carrier_pending', label: 'Документы перевозчику: не отправлены' },
  { id: 'from_carrier_pending', label: 'Документы от перевозчика: не получены' },
  { id: 'all_complete', label: 'Все документы закрыты' },
];

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
};

const isOverdue = (o: any) => !o.client_paid && daysSince(o.load_date) >= 15;

export default function Orders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payFilter, setPayFilter] = useState<string>('any');
  const [docFilter, setDocFilter] = useState<string>('any');
  const [payChipFilter, setPayChipFilter] = useState<string>('any');
  const [showFilters, setShowFilters] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setOrders(await api.orders.list());
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const applyFilters = (list: any[]) => {
    let result = list;
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter(o =>
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.client_name || '').toLowerCase().includes(q) ||
      (o.carrier_name || '').toLowerCase().includes(q) ||
      (o.route_from || '').toLowerCase().includes(q) ||
      (o.route_to || '').toLowerCase().includes(q)
    );
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter);
    if (payChipFilter === 'need_pay_carrier') result = result.filter(o => o.client_paid && !o.carrier_paid);
    else if (payChipFilter === 'wait_client') result = result.filter(o => !o.client_paid);
    if (payFilter === 'unpaid_client') result = result.filter(o => !o.client_paid);
    else if (payFilter === 'unpaid_carrier') result = result.filter(o => !o.carrier_paid);
    else if (payFilter === 'overdue') result = result.filter(isOverdue);
    else if (payFilter === 'all_paid') result = result.filter(o => o.client_paid && o.carrier_paid);

    if (docFilter === 'to_client_pending') result = result.filter(o => !o.docs_to_client_sent);
    else if (docFilter === 'from_client_pending') result = result.filter(o => !o.docs_from_client_received);
    else if (docFilter === 'to_carrier_pending') result = result.filter(o => !o.docs_to_carrier_sent);
    else if (docFilter === 'from_carrier_pending') result = result.filter(o => !o.docs_from_carrier_received);
    else if (docFilter === 'all_complete') result = result.filter(o => o.docs_to_client_sent && o.docs_from_client_received && o.docs_to_carrier_sent && o.docs_from_carrier_received);

    return result;
  };

  const filtered = applyFilters(orders);

  const statusChips = [
    { id: 'all', label: 'Все', count: orders.length },
    { id: 'new', label: 'Новые', count: orders.filter(o => o.status === 'new').length },
    { id: 'in_progress', label: 'В работе', count: orders.filter(o => o.status === 'in_progress').length },
    { id: 'delivered', label: 'Доставлено', count: orders.filter(o => o.status === 'delivered').length },
  ];

  const payChips = [
    { id: 'need_pay_carrier', label: 'Клиент оплатил, перевозчику нет', count: orders.filter(o => o.client_paid && !o.carrier_paid).length },
    { id: 'wait_client', label: 'Жду оплату от клиента', count: orders.filter(o => !o.client_paid).length },
  ];

  const activeFilters = (payFilter !== 'any' ? 1 : 0) + (docFilter !== 'any' ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top + 16 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.kicker}>СДЕЛКИ</Text>
            <Text style={styles.title}>Заявки</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity testID="sync-btn" onPress={syncAndReload} disabled={syncing} style={styles.iconBtn} activeOpacity={0.7}>
              {syncing ? <ActivityIndicator size="small" color={theme.colors.accent} /> : <RefreshCw size={18} color={theme.colors.textSecondary} strokeWidth={1.6} />}
            </TouchableOpacity>
            <TouchableOpacity testID="toggle-filters" onPress={() => setShowFilters(!showFilters)} style={[styles.iconBtn, showFilters && { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent }]} activeOpacity={0.7}>
              <FilterIcon size={18} color={showFilters ? theme.colors.accent : theme.colors.textSecondary} strokeWidth={1.6} />
              {activeFilters > 0 && <View style={styles.dot}><Text style={styles.dotText}>{activeFilters}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity testID="add-order-btn" onPress={() => router.push('/order/new')} style={styles.fab} activeOpacity={0.8}>
              <Plus size={20} color="#000" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по номеру, клиенту, перевозчику, маршруту"
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          horizontal
          data={statusChips}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 16, paddingBottom: 4 }}
          renderItem={({ item }) => {
            const active = statusFilter === item.id;
            return (
              <TouchableOpacity testID={`filter-${item.id}`} onPress={() => setStatusFilter(item.id)} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.7}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                <Text style={[styles.chipCount, active && styles.chipCountActive]}>{item.count}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <FlatList
          horizontal
          data={payChips}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 4 }}
          renderItem={({ item }) => {
            const active = payChipFilter === item.id;
            return (
              <TouchableOpacity
                onPress={() => setPayChipFilter(active ? 'any' : item.id)}
                style={[styles.chip, active && styles.chipPayActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipPayTextActive]}>{item.label}</Text>
                <Text style={[styles.chipCount, active && styles.chipPayCountActive]}>{item.count}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {showFilters && (
          <View style={styles.filterPanel}>
            <Picker
              label="Фильтр по оплате"
              value={payFilter}
              items={PAY_FILTER}
              onSelect={(it) => setPayFilter(it.id)}
              searchable={false}
              testID="filter-pay"
            />
            <Picker
              label="Фильтр по документам"
              value={docFilter}
              items={DOC_FILTER}
              onSelect={(it) => setDocFilter(it.id)}
              searchable={false}
              testID="filter-docs"
            />
            {activeFilters > 0 && (
              <TouchableOpacity onPress={() => { setPayFilter('any'); setDocFilter('any'); setPayChipFilter('any'); }} style={styles.resetBtn} activeOpacity={0.7}>
                <Text style={styles.resetText}>Сбросить фильтры</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : (
        <FlatList
          testID="orders-list"
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.accent} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index }) => <OrderCard order={item} onPress={() => router.push(`/order/${item.id}`)} testID={`order-card-${index}`} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет заявок по фильтру</Text>}
        />
      )}
    </View>
  );
}

function OrderCard({ order, onPress, testID }: any) {
  const margin = (order.client_rate || 0) - (order.carrier_rate || 0);
  const overdue = isOverdue(order);
  const days = daysSince(order.load_date);

  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7} style={[styles.card, overdue && styles.cardOverdue]}>
      {overdue && (
        <View style={styles.overdueBanner}>
          <AlertTriangle size={12} color="#fff" strokeWidth={2} />
          <Text style={styles.overdueText}>ПРОСРОЧКА · {days} ДН. БЕЗ ОПЛАТЫ ОТ КЛИЕНТА</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <Text style={styles.orderNum}>{order.order_number}</Text>
        <Badge label={statusLabels[order.status] || order.status} color={statusColors[order.status] || theme.colors.textTertiary} />
      </View>

      <View style={styles.routeRow}>
        <MapPin size={14} color={theme.colors.accent} strokeWidth={1.6} />
        <Text style={styles.routeText} numberOfLines={1}>{order.route_from}</Text>
        <ArrowRight size={14} color={theme.colors.textTertiary} strokeWidth={1.6} />
        <Text style={styles.routeText} numberOfLines={1}>{order.route_to}</Text>
      </View>

      <Text style={styles.client} numberOfLines={1}>{order.client_name || '—'}</Text>

      <View style={styles.bottomRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Calendar size={12} color={theme.colors.textTertiary} strokeWidth={1.6} />
          <Text style={styles.date}>{order.load_date || '—'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.rate}>{formatMoney(order.client_rate)}</Text>
          <Text style={[styles.margin, { color: margin >= 0 ? theme.colors.profit : theme.colors.loss }]}>+{formatMoney(margin)} маржа</Text>
        </View>
      </View>

      <View style={styles.payRow}>
        <View style={[styles.payDot, { backgroundColor: order.client_paid ? theme.colors.profit : theme.colors.surfaceHigh }]} />
        <Text style={[styles.payText, { color: order.client_paid ? theme.colors.profit : theme.colors.textTertiary }]}>{order.client_paid ? 'Клиент оплатил' : 'Ждём от клиента'}</Text>
        <View style={{ width: 12 }} />
        <View style={[styles.payDot, { backgroundColor: order.carrier_paid ? theme.colors.profit : theme.colors.surfaceHigh }]} />
        <Text style={[styles.payText, { color: order.carrier_paid ? theme.colors.profit : theme.colors.textTertiary }]}>{order.carrier_paid ? 'Перевозчик оплачен' : 'Долг перевозчику'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#000', fontSize: 9, fontWeight: '700' },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999 },
  chipActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  chipPayActive: { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning },
  chipText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: theme.colors.accent },
  chipPayTextActive: { color: theme.colors.warning },
  chipCount: { color: theme.colors.textTertiary, fontSize: 11, fontWeight: '700', backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  chipCountActive: { color: theme.colors.accent, backgroundColor: theme.colors.accent + '20' },
  chipPayCountActive: { color: theme.colors.warning, backgroundColor: theme.colors.warning + '20' },

  filterPanel: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, marginTop: 12 },
  resetBtn: { paddingVertical: 8, alignItems: 'center' },
  resetText: { color: theme.colors.accent, fontSize: 12, fontWeight: '600' },

  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16, overflow: 'hidden' },
  cardOverdue: { borderColor: theme.colors.loss + '60' },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.loss, marginHorizontal: -16, marginTop: -16, marginBottom: 12, paddingVertical: 6, paddingHorizontal: 12 },
  overdueText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  orderNum: { color: theme.colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  routeText: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  client: { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  date: { color: theme.colors.textTertiary, fontSize: 12 },
  rate: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
  margin: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  payDot: { width: 6, height: 6, borderRadius: 3 },
  payText: { fontSize: 11, fontWeight: '600' },
  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
});
