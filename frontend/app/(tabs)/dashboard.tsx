import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight, Briefcase, Wallet, Users, Truck, RefreshCw, CheckCircle2, AlertTriangle, Sun, Moon, Link2, LogIn, LogOut } from 'lucide-react-native';
import { theme, formatMoney, formatShort } from '../../src/theme';
import { useTheme } from '../../src/themeContext';
import { api } from '../../src/api';
import { Picker } from '../../src/components/Picker';
import { Linking } from 'react-native';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const monthLabel = (ym: string) => {
  if (!ym) return ym;
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { mode, toggle } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<string>(currentMonth());

  // Sheets import state
  const [syncing, setSyncing] = useState(false);
  const [importStatus, setImportStatus] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<any>({ connected: false });

  const load = useCallback(async (p: string) => {
    try {
      const d = await api.dashboard(p);
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(period); }, [load, period]));
  useEffect(() => { load(period); }, [load, period]);

  // Получим начальный статус импорта
  useEffect(() => {
    api.sync.importStatus().then(setImportStatus).catch(() => {});
    api.auth.googleStatus().then(setAuthStatus).catch(() => {});
  }, []);

  const connectGoogle = async () => {
    try {
      const r = await api.auth.googleStart();
      if (r?.auth_url) {
        // открываем в новой вкладке/окне
        if (typeof window !== 'undefined') {
          (window as any).open(r.auth_url, '_blank');
        } else {
          await Linking.openURL(r.auth_url);
        }
        // через 2 сек перепроверим статус
        setTimeout(() => api.auth.googleStatus().then(setAuthStatus).catch(() => {}), 3000);
      }
    } catch (e: any) {
      Alert.alert('OAuth не настроен',
        e?.message?.includes('не заданы')
          ? 'Сначала добавьте GOOGLE_OAUTH_CLIENT_ID и GOOGLE_OAUTH_CLIENT_SECRET в backend/.env. Подробная инструкция — в чате.'
          : (e?.message || 'Ошибка'));
    }
  };

  const disconnectGoogle = async () => {
    Alert.alert('Отключить Google?', 'Документы перестанут генерироваться, пока вы не авторизуетесь снова.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Отключить', style: 'destructive', onPress: async () => {
        await api.auth.googleDisconnect();
        setAuthStatus({ connected: false });
      } },
    ]);
  };

  const doImport = async () => {
    setSyncing(true);
    try {
      const r = await api.sync.importFromSheets();
      setImportStatus(r);
      if (r.ok) {
        Alert.alert(
          'Загружено из таблицы',
          `Клиентов: ${r.imported?.clients ?? 0}\nПеревозчиков: ${r.imported?.carriers ?? 0}\nЗаказов: ${r.imported?.orders ?? 0}`,
        );
        // Перезагружаем дашборд
        load(period);
      } else {
        Alert.alert('Не удалось загрузить', r.message || 'Неизвестная ошибка');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Сеть недоступна');
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = () => {
    Alert.alert(
      'Загрузить из Google Таблицы?',
      'Все данные клиентов, перевозчиков и заказов в приложении будут заменены актуальными данными из вашей Google Таблицы. В таблице ничего не изменится.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Загрузить', style: 'default', onPress: doImport },
      ],
    );
  };

  if (loading && !data) {
    return <View style={[styles.center, { backgroundColor: theme.colors.bg }]}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  const d = data || {};
  const marginPositive = (d.total_margin || 0) >= 0;
  const months: string[] = d.available_months || [];
  const cm = currentMonth();

  // Список периодов для дропдауна
  const periodItems = [
    { id: 'all', label: 'За всё время' },
    { id: cm, label: `Этот месяц · ${monthLabel(cm)}` },
    ...months.filter(m => m !== cm).map(m => ({ id: m, label: monthLabel(m) })),
  ];
  const periodValue = period;

  return (
    <ScrollView
      testID="dashboard-screen"
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(period); }} tintColor={theme.colors.accent} />}
    >
      <View style={{ paddingHorizontal: 20 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ОБЗОР</Text>
            <Text style={styles.title}>Дашборд</Text>
          </View>
          <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.themeBtn} testID="theme-toggle">
            {mode === 'dark' ? (
              <Sun size={16} color={theme.colors.accent} strokeWidth={1.6} />
            ) : (
              <Moon size={16} color={theme.colors.accent} strokeWidth={1.6} />
            )}
            <Switch
              value={mode === 'light'}
              onValueChange={toggle}
              trackColor={{ false: theme.colors.surfaceElevated, true: theme.colors.accent + '60' }}
              thumbColor={theme.colors.accent}
              ios_backgroundColor={theme.colors.surfaceElevated}
            />
          </TouchableOpacity>
        </View>

        {/* Дропдаун периодов */}
        <Picker
          testID="period-picker"
          label="Период"
          value={periodValue}
          items={periodItems}
          onSelect={(it) => setPeriod(it.id)}
          searchable={false}
        />

        {/* Hero: Маржа */}
        <View style={styles.heroCard}>
          <Text style={styles.metricLabel}>МАРЖА · {period === 'all' ? 'ВСЕГО' : monthLabel(period).toUpperCase()}</Text>
          <View style={styles.marginRow}>
            <Text style={[styles.metricBig, { color: marginPositive ? theme.colors.profit : theme.colors.loss }]}>
              {formatMoney(d.total_margin)}
            </Text>
            {marginPositive ? <TrendingUp size={20} color={theme.colors.profit} strokeWidth={2} /> : <TrendingDown size={20} color={theme.colors.loss} strokeWidth={2} />}
          </View>
          {/* Сравнение с предыдущим месяцем */}
          {(d.prev_period && d.prev_margin !== null) ? (
            <View style={styles.compareRow}>
              {d.margin_change_pct !== null && d.margin_change_pct !== undefined ? (
                <View style={[styles.compareBadge, { backgroundColor: (d.margin_change_pct >= 0 ? theme.colors.profit : theme.colors.loss) + '18', borderColor: (d.margin_change_pct >= 0 ? theme.colors.profit : theme.colors.loss) + '40' }]}>
                  {d.margin_change_pct >= 0 ? <TrendingUp size={12} color={theme.colors.profit} strokeWidth={2} /> : <TrendingDown size={12} color={theme.colors.loss} strokeWidth={2} />}
                  <Text style={[styles.compareBadgeTxt, { color: d.margin_change_pct >= 0 ? theme.colors.profit : theme.colors.loss }]}>
                    {d.margin_change_pct >= 0 ? '+' : ''}{d.margin_change_pct}%
                  </Text>
                </View>
              ) : null}
              <Text style={styles.compareSub}>
                к {monthLabel(d.prev_period).toLowerCase()} ({formatMoney(d.prev_margin)})
              </Text>
            </View>
          ) : null}

          <View style={styles.heroDivider} />

          <Text style={styles.subLabel}>ПРИБЫЛЬ (ПОСЛЕ 20% НАЛОГА)</Text>
          <Text style={[styles.profitValue, { color: theme.colors.accent }]}>{formatMoney(d.profit)}</Text>
        </View>

        {/* Cashflow alerts */}
        <View style={styles.bentoRow}>
          <View style={[styles.bentoCard, { borderColor: theme.colors.warning + '40' }]}>
            <ArrowDownRight size={18} color={theme.colors.warning} strokeWidth={1.6} />
            <Text style={styles.bentoLabel}>ОЖИДАЕТСЯ ОТ КЛИЕНТОВ</Text>
            <Text style={[styles.bentoValue, { color: theme.colors.warning }]}>{formatMoney(d.unpaid_by_clients)}</Text>
          </View>
          <View style={[styles.bentoCard, { borderColor: theme.colors.loss + '40' }]}>
            <ArrowUpRight size={18} color={theme.colors.loss} strokeWidth={1.6} />
            <Text style={styles.bentoLabel}>К ОПЛАТЕ ПЕРЕВОЗЧИКАМ</Text>
            <Text style={[styles.bentoValue, { color: theme.colors.loss }]}>{formatMoney(d.owed_to_carriers)}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatTile icon={<Briefcase size={16} color={theme.colors.accent} strokeWidth={1.6} />} label="Активных" value={String(d.active_orders || 0)} />
          <StatTile icon={<Wallet size={16} color={theme.colors.profit} strokeWidth={1.6} />} label="Доставлено" value={String(d.delivered_orders || 0)} />
          <StatTile icon={<Users size={16} color={theme.colors.info} strokeWidth={1.6} />} label="Клиентов" value={String(d.clients_count || 0)} />
          <StatTile icon={<Truck size={16} color={theme.colors.accent} strokeWidth={1.6} />} label="Перевозчиков" value={String(d.carriers_count || 0)} />
        </View>

        {/* Должники */}
        {(d.debtors || []).length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ДОЛЖНИКИ — КЛИЕНТЫ</Text>
            <View style={styles.listCard}>
              {(d.debtors || []).map((c: any, i: number) => (
                <DebtRow key={c.name} item={c} color={theme.colors.warning} last={i === d.debtors.length - 1} />
              ))}
            </View>
          </>
        )}

        {/* Кому должен */}
        {(d.creditors || []).length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ДОЛЖЕН ПЕРЕВОЗЧИКАМ</Text>
            <View style={styles.listCard}>
              {(d.creditors || []).map((c: any, i: number) => (
                <DebtRow key={c.name} item={c} color={theme.colors.loss} last={i === d.creditors.length - 1} />
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>СТАТУСЫ ЗАЯВОК</Text>
        <View style={styles.statusCard}>
          <StatusBar label="Новые" value={d.status_breakdown?.new || 0} total={d.total_orders || 1} color={theme.colors.info} />
          <StatusBar label="В работе" value={d.status_breakdown?.in_progress || 0} total={d.total_orders || 1} color={theme.colors.warning} />
          <StatusBar label="Доставлено" value={d.status_breakdown?.delivered || 0} total={d.total_orders || 1} color={theme.colors.profit} />
          <StatusBar label="Отменено" value={d.status_breakdown?.cancelled || 0} total={d.total_orders || 1} color={theme.colors.loss} />
        </View>

        {(d.top_clients || []).length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ТОП КЛИЕНТОВ</Text>
            <View style={styles.listCard}>
              {(d.top_clients || []).map((c: any, i: number) => {
                const max = d.top_clients[0]?.revenue || 1;
                const pct = (c.revenue / max) * 100;
                return (
                  <View key={c.name} style={[styles.topRow, i === d.top_clients.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.topRankCircle}><Text style={styles.topRank}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topName} numberOfLines={1}>{c.name}</Text>
                      <View style={styles.bgBar}><View style={[styles.bgFill, { width: `${pct}%` }]} /></View>
                    </View>
                    <Text style={styles.topRevenue}>{formatShort(c.revenue)} Br</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        
      </View>
    </ScrollView>
  );
}

function DebtRow({ item, color, last }: any) {
  return (
    <View style={[styles.debtRow, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.debtName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.debtMeta}>{item.orders} заявок</Text>
      </View>
      <Text style={[styles.debtAmount, { color }]}>{formatMoney(item.amount)}</Text>
    </View>
  );
}

function StatTile({ icon, label, value }: any) {
  return (
    <View style={styles.statTile}>{icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusBar({ label, value, total, color }: any) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={[styles.statusValue, { color }]}>{value}</Text>
      </View>
      <View style={styles.bgBar}><View style={[styles.bgFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  themeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 999,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 6 },
  title: { fontSize: 34, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary, marginBottom: 16 },

  heroCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 20, marginBottom: 12 },
  metricLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.accent },
  marginRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  metricBig: { fontSize: 36, fontWeight: '700', letterSpacing: -1.5 },
  metricSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 4 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  compareBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderRadius: 999,
  },
  compareBadgeTxt: { fontSize: 11, fontWeight: '700' },
  compareSub: { fontSize: 11, color: theme.colors.textTertiary, flex: 1 },
  heroDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 18 },
  subLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 6 },
  profitValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },

  bentoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  bentoCard: { flex: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderRadius: 14, padding: 14 },
  bentoLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: theme.colors.textTertiary, marginTop: 8 },
  bentoValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  statTile: { width: '48%', flexGrow: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14 },
  statValue: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 8, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, color: theme.colors.textTertiary, marginTop: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 10, marginTop: 8 },
  listCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, marginBottom: 16, paddingHorizontal: 16 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  debtName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '500' },
  debtMeta: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  debtAmount: { fontSize: 14, fontWeight: '700' },

  statusCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16, marginBottom: 16 },
  statusLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  statusValue: { fontSize: 13, fontWeight: '700' },
  bgBar: { height: 4, backgroundColor: theme.colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  bgFill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: 2 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  topRankCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.accent + '20', borderWidth: 1, borderColor: theme.colors.accent + '40', alignItems: 'center', justifyContent: 'center' },
  topRank: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  topName: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 6 },
  topRevenue: { color: theme.colors.accent, fontSize: 13, fontWeight: '700', minWidth: 70, textAlign: 'right' },

  // Sheets sync
  syncCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16, marginBottom: 16 },
  syncTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  syncTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  syncSub: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  syncMeta: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 12 },
  syncError: { color: theme.colors.warning, fontSize: 12, marginTop: 12, lineHeight: 16 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, backgroundColor: theme.colors.accent, paddingVertical: 12, borderRadius: 10,
  },
  syncBtnText: { color: theme.colors.bg, fontSize: 14, fontWeight: '700' },
});
