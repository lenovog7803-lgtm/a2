import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AlertTriangle, CheckCircle2, Navigation, FileText } from 'lucide-react-native';
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
        <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function TruckDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [analytics, tripsData] = await Promise.all([
        api.truck.analytics('current'),
        api.truck.trips.list(),
      ]);
      setData(analytics);
      setTrips((tripsData as any[]).slice(0, 5));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  const needInvestor = (data?.unpaid_trips ?? []).filter((t: any) => !t.payment_investor_status || t.payment_investor_status !== 'выплачено');
  const noDocsTrips = trips.filter((t: any) => !t.documents_sent_client);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
    >
      <Text style={styles.title}>Моя Машина</Text>
      <Text style={styles.subtitle}>Текущий месяц</Text>

      <View style={styles.goalsRow}>
        <GoalCard label="Рейсов" fact={data?.trips_count ?? 0} goal={TRIPS_GOAL} />
        <GoalCard label="Выручка" fact={data?.revenue ?? 0} goal={REVENUE_GOAL} unit="BYN" />
      </View>
      <View style={styles.goalsRow}>
        <GoalCard label="Мне чистыми" fact={data?.net_ip ?? 0} goal={Math.round(REVENUE_GOAL * 0.1)} unit="BYN" />
        <GoalCard label="Инвестору" fact={data?.investor_total ?? 0} goal={Math.round(REVENUE_GOAL * 0.8)} unit="BYN" />
      </View>

      {/* Требуют внимания */}
      {(needInvestor.length > 0 || noDocsTrips.length > 0) && (
        <View style={styles.attentionBlock}>
          <Text style={styles.sectionTitle}>Требуют внимания</Text>
          {noDocsTrips.map((t: any) => (
            <TouchableOpacity key={t.id} style={styles.attentionRow} onPress={() => router.push(`/truck-trip/${t.id}`)}>
              <FileText size={16} color={theme.colors.warning} />
              <Text style={styles.attentionText}>{t.trip_number} — не отправлены документы</Text>
            </TouchableOpacity>
          ))}
          {needInvestor.slice(0, 5).map((t: any) => (
            <TouchableOpacity key={t.id} style={styles.attentionRow} onPress={() => router.push(`/truck-trip/${t.id}`)}>
              <AlertTriangle size={16} color={theme.colors.loss} />
              <Text style={styles.attentionText}>{t.trip_number} — не выплачена аренда инвестору</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Последние рейсы */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Последние рейсы</Text>
          <TouchableOpacity onPress={() => router.push('/(truck)/trips')}>
            <Text style={styles.seeAll}>Все</Text>
          </TouchableOpacity>
        </View>
        {trips.length === 0 && <Text style={styles.empty}>Нет рейсов</Text>}
        {trips.map((t: any) => (
          <TouchableOpacity key={t.id} style={styles.tripRow} onPress={() => router.push(`/truck-trip/${t.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripNumber}>{t.trip_number}</Text>
              <Text style={styles.tripRoute}>{t.route || '—'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.tripRate}>{formatMoney(t.rate_client)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusBgColor(t.status) }]}>
                <Text style={styles.statusText}>{t.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function statusBgColor(s: string) {
  switch (s) {
    case 'выполнен': return 'rgba(0,230,118,0.15)';
    case 'в работе': return 'rgba(245,158,11,0.15)';
    case 'отменён': return 'rgba(255,59,48,0.15)';
    default: return 'rgba(96,165,250,0.15)';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 2, marginTop: 8 },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginBottom: 16 },
  goalsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  goalCard: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  goalLabel: { fontSize: 11, color: theme.colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  goalFact: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  goalGoal: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  progressBg: { height: 3, backgroundColor: theme.colors.border, borderRadius: 2, marginTop: 8 },
  progressFill: { height: 3, borderRadius: 2 },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  seeAll: { fontSize: 13, color: theme.colors.accent },
  empty: { color: theme.colors.textTertiary, fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  tripRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: theme.colors.surface, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  tripNumber: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  tripRoute: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  tripRate: { fontSize: 14, fontWeight: '700', color: theme.colors.accent },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary },
  attentionBlock: { marginTop: 16, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  attentionText: { fontSize: 13, color: theme.colors.textPrimary, flex: 1 },
});
