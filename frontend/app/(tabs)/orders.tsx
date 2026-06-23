import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Modal, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Filter as FilterIcon, RefreshCw, Search, Menu } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
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

function getOrderColors(order: any): { gradient: [string, string]; border: string; dot: string } {
  if (isOverdue(order)) return { gradient: ['#FFF7ED', '#FEE2E2'], border: '#FECACA', dot: '#EF4444' };
  switch (order.status) {
    case 'delivered':   return { gradient: ['#F0FDF4', '#DCFCE7'], border: '#BBF7D0', dot: '#16A34A' };
    case 'in_progress': return { gradient: ['#EFF6FF', '#DBEAFE'], border: '#BFDBFE', dot: '#2563EB' };
    case 'new':         return { gradient: ['#F5F3FF', '#EDE9FE'], border: '#DDD6FE', dot: '#7C3AED' };
    case 'cancelled':   return { gradient: ['#F9FAFB', '#F3F4F6'], border: '#E5E7EB', dot: '#9CA3AF' };
    default:            return { gradient: ['#FFFFFF', '#F9FAFB'], border: '#E5E7EB', dot: '#6B7280' };
  }
}

function getBadge(order: any): { label: string; bg: string; color: string } {
  if (isOverdue(order)) return { label: '⚠ Просрочена', bg: '#FEE2E2', color: '#EF4444' };
  switch (order.status) {
    case 'delivered':   return { label: '✓ Доставлено', bg: '#DCFCE7', color: '#16A34A' };
    case 'in_progress': return { label: '● В работе',   bg: '#DBEAFE', color: '#2563EB' };
    case 'new':         return { label: 'Новая',         bg: '#EDE9FE', color: '#7C3AED' };
    case 'cancelled':   return { label: 'Отменена',      bg: '#F3F4F6', color: '#9CA3AF' };
    default:            return { label: order.status,    bg: '#F3F4F6', color: '#6B7280' };
  }
}

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
  const [modeVisible, setModeVisible] = useState(false);

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
    { id: 'need_pay_carrier', label: 'Долг по оплате', count: orders.filter(o => o.client_paid && !o.carrier_paid).length },
    { id: 'wait_client', label: 'Не оплаченные заявки', count: orders.filter(o => !o.client_paid).length },
  ];

  const activeFilters = (payFilter !== 'any' ? 1 : 0) + (docFilter !== 'any' ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>Заявки</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity testID="mode-btn" onPress={() => setModeVisible(true)} style={styles.iconBtn} activeOpacity={0.7}>
              <Menu size={18} color={theme.colors.textSecondary} strokeWidth={1.6} />
            </TouchableOpacity>
            <TouchableOpacity testID="sync-btn" onPress={syncAndReload} disabled={syncing} style={styles.iconBtn} activeOpacity={0.7}>
              {syncing ? <ActivityIndicator size="small" color={theme.colors.accent} /> : <RefreshCw size={18} color={theme.colors.textSecondary} strokeWidth={1.6} />}
            </TouchableOpacity>
            <TouchableOpacity testID="toggle-filters" onPress={() => setShowFilters(!showFilters)} style={[styles.iconBtn, showFilters && { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent }]} activeOpacity={0.7}>
              <FilterIcon size={18} color={showFilters ? theme.colors.accent : theme.colors.textSecondary} strokeWidth={1.6} />
              {activeFilters > 0 && <View style={styles.dot}><Text style={styles.dotText}>{activeFilters}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity testID="add-order-btn" onPress={() => router.push('/order/new')} style={styles.fab} activeOpacity={0.8}>
              <Plus size={20} color={theme.colors.bg} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={14} color={theme.colors.textTertiary} strokeWidth={1.5} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск..."
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.accent} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item, index }) => <OrderCard order={item} onPress={() => router.push(`/order/${item.id}`)} testID={`order-card-${index}`} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет заявок по фильтру</Text>}
        />
      )}

      <Modal transparent visible={modeVisible} animationType="fade" onRequestClose={() => setModeVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModeVisible(false)}>
          <View style={styles.modeOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modeSheet, { top: insets.top + 60, right: 20 }]}>
                <Text style={styles.modeSheetTitle}>Режим работы</Text>
                <TouchableOpacity style={[styles.modeItem, styles.modeItemActive]} onPress={() => setModeVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.modeItemIcon}>✅</Text>
                  <Text style={[styles.modeItemText, styles.modeItemTextActive]}>Экспедирование</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modeItem} onPress={() => { setModeVisible(false); router.replace('/(truck)/dashboard' as any); }} activeOpacity={0.7}>
                  <Text style={styles.modeItemIcon}>🚛</Text>
                  <Text style={styles.modeItemText}>Моя Машина</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function OrderCard({ order, onPress, testID }: any) {
  const { gradient, border, dot } = getOrderColors(order);
  const badge = getBadge(order);
  const margin = (order.client_rate || 0) - (order.carrier_rate || 0);

  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.82} style={{ marginHorizontal: 16, marginBottom: 10 }}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 18,
          padding: 16,
          borderWidth: 0.5,
          borderColor: border,
          shadowColor: dot,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Строка 1: номер + бейдж */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '500', color: '#9CA3AF' }}>
            № {order.order_number}
          </Text>
          <View style={{ backgroundColor: badge.bg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: badge.color }}>{badge.label}</Text>
          </View>
        </View>

        {/* Клиент */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a2e', marginBottom: 14 }} numberOfLines={1}>
          {order.client_name || '—'}
        </Text>

        {/* Маршрут */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {/* Вертикальная линия с точками */}
          <View style={{ alignItems: 'center', paddingTop: 4, width: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
            <View style={{ flex: 1, marginVertical: 3, gap: 2, alignItems: 'center' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={{ width: 1.5, height: 3, backgroundColor: '#CBD5E1' }} />
              ))}
            </View>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' }} />
          </View>

          {/* Точки маршрута */}
          <View style={{ flex: 1, justifyContent: 'space-between', gap: 10 }}>
            <View>
              <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginBottom: 1 }}>Откуда</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }} numberOfLines={1}>
                {order.route_from || '—'}
              </Text>
              {!!order.load_date && (
                <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                  {order.load_date.slice(0, 10).split('-').reverse().join('.')}
                </Text>
              )}
            </View>
            <View>
              <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginBottom: 1 }}>Куда</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }} numberOfLines={1}>
                {order.route_to || '—'}
              </Text>
              {!!order.unload_date && (
                <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                  {order.unload_date.slice(0, 10).split('-').reverse().join('.')}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Разделитель */}
        <View style={{ height: 0.5, backgroundColor: 'rgba(0,0,0,0.08)', marginBottom: 12 }} />

        {/* Ставка + маржа */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 }}>Ставка клиента</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1a2e', letterSpacing: -0.5 }}>
              {order.client_rate ? Number(order.client_rate).toLocaleString('ru-RU') + ' Br' : '—'}
            </Text>
          </View>
          {margin > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 }}>Маржа</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#16A34A' }}>
                +{margin.toLocaleString('ru-RU')} Br
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 },
  dot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: theme.colors.bg, fontSize: 9, fontWeight: '700' },

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

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardOverdue: { borderColor: theme.colors.loss + '60', shadowColor: theme.colors.loss, shadowOpacity: 0.1 },
  cardDeliveryOverdue: { borderLeftWidth: 3, borderLeftColor: '#E0473B' },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.loss, marginHorizontal: -12, marginTop: -12, marginBottom: 10, paddingVertical: 5, paddingHorizontal: 10 },
  overdueText: { color: theme.colors.bg, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  orderNum: { color: theme.colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  routeText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  client: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 8 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  date: { color: theme.colors.textTertiary, fontSize: 11 },
  rate: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  margin: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: theme.colors.border },
  payDot: { width: 5, height: 5, borderRadius: 3 },
  payText: { fontSize: 10, fontWeight: '600' },
  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: 12, marginHorizontal: 16, marginTop: 10, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: theme.colors.border },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },

  modeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modeSheet: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: 220,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modeSheetTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4,
  },
  modeItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  modeItemActive: { backgroundColor: theme.colors.accent + '20' },
  modeItemIcon: { fontSize: 16 },
  modeItemText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  modeItemTextActive: { color: theme.colors.accent },
});
