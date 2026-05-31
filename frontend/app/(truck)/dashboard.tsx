import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Plus, FileText, Navigation } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const TRIPS_GOAL = 6;
const REVENUE_GOAL = 15000;

function GoalCard({ label, fact, goal, unit = '' }: { label: string; fact: number; goal: number; unit?: string }) {
  const pct = goal > 0 ? Math.min(fact / goal, 1) : 0;
  const color = pct >= 1 ? theme.colors.profit : pct >= 0.6 ? theme.colors.warning : theme.colors.info;
  return (
    <View style={styles.goalCard}>
      <Text style={styles.goalLabel}>{label}</Text>
      <Text style={[styles.goalFact, { color }]}>
        {unit === 'BYN' ? formatMoney(fact) : String(fact)}
      </Text>
      <Text style={styles.goalGoal}>
        / {unit === 'BYN' ? formatMoney(goal) : String(goal)}
      </Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function TruckDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [a, trips] = await Promise.all([
        api.truck.analytics('current'),
        api.truck.trips.list(),
      ]);
      setAnalytics(a);
      setRecentTrips((trips as any[]).slice(0, 5));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  const unpaidTrips: any[] = analytics?.unpaid_trips ?? [];
  const noDocsTrips = recentTrips.filter((t: any) => !t.documents_sent_client);
  const needAttention = [...noDocsTrips.slice(0, 3), ...unpaidTrips.slice(0, 3)];

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
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/truck-trip/new')}>
          <Plus size={20} color="#000" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <View style={styles.goalsRow}>
        <GoalCard label="Рейсов" fact={analytics?.trips_count ?? 0} goal={TRIPS_GOAL} />
        <GoalCard label="Выручка" fact={analytics?.revenue ?? 0} goal={REVENUE_GOAL} unit="BYN" />
      </View>
      <View style={styles.goalsRow}>
        <GoalCard label="Мне чистыми" fact={analytics?.net_ip ?? 0} goal={1500} unit="BYN" />
        <GoalCard label="Инвестору" fact={analytics?.investor_total ?? 0} goal={12000} unit="BYN" />
      </View>

      {needAttention.length > 0 && (
        <View style={styles.attentionBlock}>
          <Text style={styles.sectionLabel}>ТРЕБУЮТ ВНИМАНИЯ</Text>
          {noDocsTrips.slice(0, 3).map((t: any) => (
            <TouchableOpacity key={`d-${t.id}`} style={styles.attentionRow} onPress={() => router.push(`/truck-trip/${t.id}`)}>
              <FileText size={14} color={theme.colors.warning} />
              <Text style={styles.attentionText}>{t.trip_number} — не отправлены документы</Text>
            </TouchableOpacity>
          ))}
          {unpaidTrips.slice(0, 3).map((t: any) => (
            <TouchableOpacity key={`u-${t.id}`} style={styles.attentionRow} onPress={() => router.push(`/truck-trip/${t.id}`)}>
              <AlertTriangle size={14} color={theme.colors.loss} />
              <Text style={styles.attentionText}>{t.trip_number} — не выплачена аренда инвестору</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ПОСЛЕДНИЕ РЕЙСЫ</Text>
          <TouchableOpacity onPress={() => router.push('/(truck)/trips')}>
            <Text style={styles.seeAll}>Все →</Text>
          </TouchableOpacity>
        </View>
        {recentTrips.length === 0 && (
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/truck-trip/new')}>
            <Navigation size={24} color={theme.colors.textTertiary} />
            <Text style={styles.emptyText}>Нет рейсов. Создать первый →</Text>
          </TouchableOpacity>
        )}
        {recentTrips.map((t: any) => (
          <TouchableOpacity key={t.id} style={styles.tripCard} onPress={() => router.push(`/truck-trip/${t.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripNum}>{t.trip_number}</Text>
              <Text style={styles.tripMeta}>{t.truck_name || '—'} · {t.driver_name || '—'}</Text>
              <Text style={styles.tripRoutes}>{t.routes_count ?? 0} маршрутов</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.tripRate}>{formatMoney(t.rate_total)}</Text>
              <Text style={[styles.tripStatus, { color: statusColor(t.status) }]}>{t.status}</Text>
              {(t.bonus_amount ?? 0) > 0 && (
                <Text style={styles.tripBonus}>🎁 +{formatMoney(t.bonus_amount)}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function statusColor(s: string) {
  switch (s) {
    case 'доставлено': return theme.colors.profit;
    case 'забрали': return theme.colors.warning;
    case 'отменён': return theme.colors.loss;
    default: return theme.colors.info;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  goalsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  goalCard: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  goalLabel: { fontSize: 10, color: theme.colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  goalFact: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  goalGoal: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 1 },
  progressBg: { height: 3, backgroundColor: theme.colors.border, borderRadius: 2, marginTop: 8 },
  progressFill: { height: 3, borderRadius: 2 },
  attentionBlock: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20 },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  attentionText: { fontSize: 13, color: theme.colors.textPrimary, flex: 1 },
  section: { marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary },
  seeAll: { fontSize: 13, color: theme.colors.accent },
  emptyCard: {
    backgroundColor: theme.colors.surface, borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 8,
  },
  emptyText: { color: theme.colors.textTertiary, fontSize: 14 },
  tripCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: theme.colors.surface, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  tripNum: { fontSize: 14, fontWeight: '700', color: theme.colors.accent },
  tripMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  tripRoutes: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  tripRate: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  tripStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  tripBonus: { fontSize: 10, color: theme.colors.accentBright, marginTop: 1 },
});
