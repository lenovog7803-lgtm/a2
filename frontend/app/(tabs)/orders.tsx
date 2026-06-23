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

const GRADIENTS_AV: [string, string][] = [
  ['#A5D8FF', '#1366F0'], ['#D0BFFF', '#7C3AED'], ['#A7F3D0', '#1E9E5A'],
  ['#FCD34D', '#D97706'], ['#FCA5A5', '#E0473B'], ['#BAE6FD', '#0891B2'],
];
function avIdx(name: string) { return (name?.charCodeAt(0) || 0) % GRADIENTS_AV.length; }
function avMono(name: string) { return (name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(); }

function getOrderColors(order: any): { gradient: [string, string]; border: string; dot: string } {
  if (isOverdue(order)) return { gradient: ['#FFF7ED', '#FEF3E8'], border: 'rgba(217,119,6,0.2)', dot: '#D97706' };
  switch (order.status) {
    case 'delivered':   return { gradient: ['#F0FDF8', '#E8FAF2'], border: 'rgba(30,158,90,0.15)', dot: '#1E9E5A' };
    case 'in_progress': return { gradient: ['#EEF4FF', '#E3ECFF'], border: 'rgba(19,102,240,0.15)', dot: '#1366F0' };
    case 'new':         return { gradient: ['#F5F3FF', '#EDE9FE'], border: 'rgba(124,58,237,0.15)', dot: '#7C3AED' };
    case 'cancelled':   return { gradient: ['#F9FAFB', '#F4F6FA'], border: 'rgba(14,23,38,0.08)', dot: '#8A93A0' };
    default:            return { gradient: ['#FFFFFF', '#F9FAFB'], border: 'rgba(14,23,38,0.08)', dot: '#8A93A0' };
  }
}

function getBadge(order: any): { label: string; bg: string; color: string } {
  if (isOverdue(order)) return { label: '⚠ Просрочена', bg: 'rgba(217,119,6,0.13)', color: '#D97706' };
  switch (order.status) {
    case 'delivered':   return { label: '✓ Доставлено', bg: 'rgba(30,158,90,0.12)', color: '#1E9E5A' };
    case 'in_progress': return { label: '● В работе',   bg: 'rgba(19,102,240,0.12)', color: '#1366F0' };
    case 'new':         return { label: 'Новая',         bg: 'rgba(124,58,237,0.12)', color: '#7C3AED' };
    case 'cancelled':   return { label: 'Отменена',      bg: 'rgba(14,23,38,0.06)', color: '#8A93A0' };
    default:            return { label: order.status,    bg: 'rgba(14,23,38,0.06)', color: '#8A93A0' };
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
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 10, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[styles.title, { fontSize: 26, fontWeight: '800', color: '#0E1726', letterSpacing: -0.8 }]}>Заявки</Text>
            <Text style={{ fontSize: 12.5, color: '#8A93A0', marginTop: 2, fontWeight: '500' }}>
              Всего: <Text style={{ fontWeight: '700', color: '#0E1726' }}>{orders.length}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity testID="mode-btn" onPress={() => setModeVisible(true)} style={[styles.iconBtn, { borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', width: 42, height: 42 }]} activeOpacity={0.7}>
              <Menu size={17} color="#5A6573" strokeWidth={1.6} />
            </TouchableOpacity>
            <TouchableOpacity testID="sync-btn" onPress={syncAndReload} disabled={syncing} style={[styles.iconBtn, { borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', width: 42, height: 42 }]} activeOpacity={0.7}>
              {syncing ? <ActivityIndicator size="small" color={theme.colors.accent} /> : <RefreshCw size={17} color="#5A6573" strokeWidth={1.6} />}
            </TouchableOpacity>
            <TouchableOpacity testID="toggle-filters" onPress={() => setShowFilters(!showFilters)} style={[styles.iconBtn, { borderRadius: 13, width: 42, height: 42, backgroundColor: showFilters ? 'rgba(19,102,240,0.1)' : '#fff', borderWidth: 1, borderColor: showFilters ? '#1366F0' : 'rgba(14,23,38,0.08)' }]} activeOpacity={0.7}>
              <FilterIcon size={17} color={showFilters ? '#1366F0' : '#5A6573'} strokeWidth={1.6} />
              {activeFilters > 0 && <View style={styles.dot}><Text style={styles.dotText}>{activeFilters}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity testID="add-order-btn" onPress={() => router.push('/order/new')} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0E1726', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 }}>
              <Plus size={15} color="#fff" strokeWidth={2.2} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Новая</Text>
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
  const badge = getBadge(order);
  const margin = (order.client_rate || 0) - (order.carrier_rate || 0);
  const marginPct = order.client_rate > 0 ? ((margin / order.client_rate) * 100).toFixed(1) : null;
  const idx = avIdx(order.client_name || '');
  const mono = avMono(order.client_name || '');

  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.88}
      style={{ marginHorizontal: 14, marginBottom: 10, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(14,23,38,0.07)', shadowColor: '#0E1726', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 3 }}>

      {/* Top: order number + badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#8A93A0', letterSpacing: 0.3 }}>
          № {order.order_number}
        </Text>
        <View style={{ backgroundColor: badge.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: badge.color }}>{badge.label}</Text>
        </View>
      </View>

      {/* Route */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{ alignItems: 'center', paddingTop: 3, width: 11 }}>
          <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 3, borderColor: '#1E9E5A', backgroundColor: '#fff' }} />
          <View style={{ width: 1.5, flex: 1, minHeight: 22, backgroundColor: 'rgba(14,23,38,0.12)', marginVertical: 3 }} />
          <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 3, borderColor: '#E0473B', backgroundColor: '#fff' }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'space-between', gap: 8 }}>
          <View>
            <Text style={{ fontSize: 10.5, color: '#8A93A0', fontWeight: '500' }}>
              {order.load_date ? order.load_date.slice(0, 10).split('-').reverse().join('.') : 'Загрузка'}
            </Text>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#0E1726', marginTop: 1 }} numberOfLines={1}>{order.route_from || '—'}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10.5, color: '#8A93A0', fontWeight: '500' }}>
              {order.unload_date ? order.unload_date.slice(0, 10).split('-').reverse().join('.') : 'Выгрузка'}
            </Text>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#0E1726', marginTop: 1 }} numberOfLines={1}>{order.route_to || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Client row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(14,23,38,0.06)' }}>
        <LinearGradient colors={GRADIENTS_AV[idx]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>{mono}</Text>
        </LinearGradient>
        <Text style={{ flex: 1, fontSize: 13, color: '#5A6573', fontWeight: '500' }} numberOfLines={1}>{order.client_name || '—'}</Text>
      </View>

      {/* Bottom: rates + margin + payments */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 10.5, color: '#8A93A0', marginBottom: 3 }}>Ставка клиента</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0E1726', letterSpacing: -0.5 }}>
            {order.client_rate ? Number(order.client_rate).toLocaleString('ru-RU') + ' Br' : '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {margin > 0 && (
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E9E5A' }}>+{margin.toLocaleString('ru-RU')} Br</Text>
              {marginPct && <Text style={{ fontSize: 10.5, color: '#8A93A0', textAlign: 'right' }}>{marginPct}%</Text>}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: order.client_paid ? 'rgba(30,158,90,0.12)' : 'rgba(217,119,6,0.12)' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: order.client_paid ? '#1E9E5A' : '#D97706' }}>К</Text>
            </View>
            <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: order.carrier_paid ? 'rgba(30,158,90,0.12)' : 'rgba(124,58,237,0.12)' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: order.carrier_paid ? '#1E9E5A' : '#7C3AED' }}>П</Text>
            </View>
          </View>
        </View>
      </View>
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

  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', borderRadius: 11 },
  chipActive: { backgroundColor: '#0E1726', borderColor: 'transparent' },
  chipPayActive: { backgroundColor: 'rgba(217,119,6,0.12)', borderColor: 'rgba(217,119,6,0.3)' },
  chipText: { color: '#5A6573', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipPayTextActive: { color: '#D97706' },
  chipCount: { color: '#8A93A0', fontSize: 11.5, fontWeight: '700', backgroundColor: 'rgba(14,23,38,0.06)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  chipCountActive: { color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.15)' },
  chipPayCountActive: { color: '#D97706', backgroundColor: 'rgba(217,119,6,0.15)' },

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
