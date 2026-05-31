import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, AlertTriangle, FileText } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(ym: string) {
  if (!ym) return ym;
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

export default function TruckDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState(currentMonth());
  const [data, setData] = useState<any>(null);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (p: string) => {
    try {
      const [a, trips] = await Promise.all([
        api.truck.analytics(p),
        api.truck.trips.list(),
      ]);
      setData(a);
      setRecentTrips((trips as any[]).slice(0, 5));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(period); }, [period]));
  const onRefresh = () => { setRefreshing(true); load(period); };

  const availableMonths: string[] = data?.available_months ?? [];
  const cm = currentMonth();

  if (loading && !data) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>МОЯ МАШИНА</Text>
          <Text style={styles.title}>Дашборд</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/truck-trip/new')}>
          <Plus size={20} color="#000" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* Period picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8 }}>
        {[
          { id: cm, label: `Этот месяц · ${monthLabel(cm)}` },
          ...availableMonths.filter(m => m !== cm).map(m => ({ id: m, label: monthLabel(m) })),
          { id: 'all', label: 'Всё время' },
        ].map(it => {
          const active = period === it.id;
          return (
            <TouchableOpacity
              key={it.id}
              onPress={() => setPeriod(it.id)}
              style={[styles.periodBtn, active && styles.periodBtnActive]}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>{it.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard label="Рейсов" value={String(data?.trips_count ?? 0)} />
        <StatCard label="Заявок" value={String(data?.orders_count ?? 0)} />
        <StatCard label="Выручка" value={formatMoney(data?.revenue ?? 0)} />
        <StatCard label="Мне чистыми" value={formatMoney(data?.net_ip ?? 0)} sub={`налог ${formatMoney(data?.tax ?? 0)}`} />
        <StatCard label="Инвестору" value={formatMoney(data?.investor_total ?? 0)} sub={(data?.bonus_total ?? 0) > 0 ? `🎁 +${formatMoney(data.bonus_total)}` : undefined} />
        <StatCard label="Топливо" value={formatMoney(data?.fuel_total ?? 0)} />
      </View>

      {/* Attention */}
      {((data?.overdue_orders ?? []).length > 0 || (data?.no_docs_orders ?? []).length > 0) && (
        <View style={styles.attentionBlock}>
          <Text style={styles.sectionLabel}>ТРЕБУЮТ ВНИМАНИЯ</Text>
          {(data?.overdue_orders ?? []).slice(0, 4).map((o: any) => (
            <TouchableOpacity key={o.id} style={styles.attRow} onPress={() => router.push(`/truck-order/${o.id}`)}>
              <AlertTriangle size={14} color={theme.colors.loss} />
              <Text style={styles.attText}>{o.order_number} — просрочена оплата ({o.client_name})</Text>
            </TouchableOpacity>
          ))}
          {(data?.no_docs_orders ?? []).slice(0, 4).map((o: any) => (
            <TouchableOpacity key={`d${o.id}`} style={styles.attRow} onPress={() => router.push(`/truck-order/${o.id}`)}>
              <FileText size={14} color={theme.colors.warning} />
              <Text style={styles.attText}>{o.order_number} — документы не высланы</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent trips */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ПОСЛЕДНИЕ РЕЙСЫ</Text>
          <TouchableOpacity onPress={() => router.push('/(truck)/trips')}>
            <Text style={styles.seeAll}>Все →</Text>
          </TouchableOpacity>
        </View>
        {recentTrips.length === 0 && (
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/truck-trip/new')}>
            <Text style={styles.emptyText}>Нет рейсов — создать первый →</Text>
          </TouchableOpacity>
        )}
        {recentTrips.map((t: any) => (
          <TouchableOpacity key={t.id} style={styles.tripCard} onPress={() => router.push(`/truck-trip/${t.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripNum}>{t.trip_number}</Text>
              <Text style={styles.tripMeta}>{t.truck_name || '—'} · {t.driver_name || '—'}</Text>
              <Text style={styles.tripOrders}>{t.orders_count ?? 0} заявок</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.tripRate}>{formatMoney(t.rate_total)}</Text>
              <Text style={[styles.tripStatus, { color: sColor(t.status) }]}>{t.status}</Text>
              {(t.bonus_amount ?? 0) > 0 && <Text style={styles.tripBonus}>🎁 +{formatMoney(t.bonus_amount)}</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function sColor(s: string) {
  if (s === 'доставлено') return theme.colors.profit;
  if (s === 'забрали') return theme.colors.warning;
  if (s === 'отменён') return theme.colors.loss;
  return theme.colors.info;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  periodBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  periodText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  periodTextActive: { color: '#000' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.textTertiary, textTransform: 'uppercase', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  statSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },
  attentionBlock: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20 },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  attText: { fontSize: 13, color: theme.colors.textPrimary, flex: 1 },
  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary },
  seeAll: { fontSize: 13, color: theme.colors.accent },
  emptyCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  emptyText: { color: theme.colors.textTertiary, fontSize: 14 },
  tripCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.colors.surface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  tripNum: { fontSize: 14, fontWeight: '700', color: theme.colors.accent, letterSpacing: 0.5 },
  tripMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  tripOrders: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  tripRate: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  tripStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  tripBonus: { fontSize: 10, color: theme.colors.accentBright, marginTop: 1 },
});
