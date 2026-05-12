import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, Switch, useWindowDimensions, Modal, TextInput } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight, Briefcase, Wallet, Users, Truck, RefreshCw, CheckCircle2, AlertTriangle, Sun, Moon, Link2, LogIn, LogOut, ChevronRight, X, UserPlus } from 'lucide-react-native';
import { theme, formatMoney, formatShort, leadStatusColors, leadStatusLabels } from '../../src/theme';
import { useTheme } from '../../src/themeContext';
import { api } from '../../src/api';
import { Picker } from '../../src/components/Picker';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROLE_KEY } from '../../src/auth';

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

async function logout(router: any) {
  await AsyncStorage.multiRemove(['jwt_token', 'user_role', 'user_data']).catch(() => {});
  router.replace('/login' as any);
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, toggleTheme } = useTheme();
  const [data, setData] = useState<any>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<string>(currentMonth());
  const [selectedDebtor, setSelectedDebtor] = useState<{ name: string; isCreditor: boolean } | null>(null);
  const [dashView, setDashView] = useState<'dashboard' | 'manager'>('dashboard');
  const [leads, setLeads] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState<any[]>([]);
  const [teamManagers, setTeamManagers] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [teamStatsUser, setTeamStatsUser] = useState<any>(null);
  const [teamStatsData, setTeamStatsData] = useState<any>(null);
  const [teamStatsPeriod, setTeamStatsPeriod] = useState<string>(currentMonth());
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);

  // Sheets import state
  const [syncing, setSyncing] = useState(false);
  const [importStatus, setImportStatus] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<any>({ connected: false });

  useEffect(() => {
    AsyncStorage.getItem(ROLE_KEY).then(r => setCurrentUserRole(r || '')).catch(() => {});
    AsyncStorage.getItem('user_data').then(raw => {
      try { const u = JSON.parse(raw || '{}'); setCurrentUserId(u.id || ''); } catch {}
    }).catch(() => {});
  }, []);

  const load = useCallback(async (p: string) => {
    try {
      const [d, orders, leadsData, statsData] = await Promise.all([
        api.dashboard(p),
        api.orders.list(),
        api.leads.list().catch(() => [] as any[]),
        api.leads.activityStats().catch(() => [] as any[]),
      ]);
      setData(d);
      setAllOrders(orders);
      setLeads(leadsData);
      setActivityStats(statsData);
      api.users.activitySummary().then(setTeamManagers).catch(() => {});
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

  useEffect(() => {
    if (!teamStatsUser) return;
    setTeamStatsLoading(true);
    setTeamStatsData(null);
    api.users.stats(teamStatsUser.id, teamStatsPeriod)
      .then(setTeamStatsData)
      .catch(() => setTeamStatsData(null))
      .finally(() => setTeamStatsLoading(false));
  }, [teamStatsUser, teamStatsPeriod]);

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
    <>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => toggleTheme()} activeOpacity={0.7} style={styles.themeBtn} testID="theme-toggle">
              {mode === 'dark' ? (
                <Sun size={16} color={theme.colors.accent} strokeWidth={1.6} />
              ) : (
                <Moon size={16} color={theme.colors.accent} strokeWidth={1.6} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => logout(router)}
              activeOpacity={0.7}
              style={styles.logoutBtn}
              testID="logout-btn"
            >
              <LogOut size={16} color={theme.colors.loss} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity onPress={() => setDashView('dashboard')} style={[styles.modeBtn, dashView === 'dashboard' && styles.modeBtnActive]} activeOpacity={0.7}>
            <Text style={[styles.modeBtnText, dashView === 'dashboard' && styles.modeBtnTextActive]}>Дашборд</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDashView('manager')} style={[styles.modeBtn, dashView === 'manager' && styles.modeBtnActive]} activeOpacity={0.7}>
            <Text style={[styles.modeBtnText, dashView === 'manager' && styles.modeBtnTextActive]}>Менеджер</Text>
          </TouchableOpacity>
        </View>

        {dashView === 'dashboard' ? (<>
        {/* Дропдаун периодов */}
        <Picker
          testID="period-picker"
          label="Период"
          value={periodValue}
          items={periodItems}
          onSelect={(it) => setPeriod(it.id)}
          searchable={false}
        />

        {currentUserRole !== 'manager' && (<>
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
        </>)}

        <View style={styles.statsGrid}>
          <StatTile icon={<Briefcase size={16} color={theme.colors.accent} strokeWidth={1.6} />} label="Активных" value={String(d.active_orders || 0)} />
          <StatTile icon={<Wallet size={16} color={theme.colors.profit} strokeWidth={1.6} />} label="Доставлено" value={String(d.delivered_orders || 0)} />
          <StatTile icon={<Users size={16} color={theme.colors.info} strokeWidth={1.6} />} label="Клиентов" value={String(d.clients_count || 0)} />
          <StatTile icon={<Truck size={16} color={theme.colors.accent} strokeWidth={1.6} />} label="Перевозчиков" value={String(d.carriers_count || 0)} />
        </View>

        {/* Должники */}
        {currentUserRole !== 'manager' && (d.debtors || []).length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ДОЛЖНИКИ — КЛИЕНТЫ</Text>
            <View style={styles.listCard}>
              {(d.debtors || []).map((c: any, i: number) => (
                <DebtRow
                  key={c.name}
                  item={c}
                  color={theme.colors.warning}
                  last={i === d.debtors.length - 1}
                  onPress={() => setSelectedDebtor({ name: c.name, isCreditor: false })}
                />
              ))}
            </View>
          </>
        )}

        {/* Кому должен */}
        {currentUserRole !== 'manager' && (d.creditors || []).length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ДОЛЖЕН ПЕРЕВОЗЧИКАМ</Text>
            <View style={styles.listCard}>
              {(d.creditors || []).map((c: any, i: number) => (
                <DebtRow
                  key={c.name}
                  item={c}
                  color={theme.colors.loss}
                  last={i === d.creditors.length - 1}
                  onPress={() => setSelectedDebtor({ name: c.name, isCreditor: true })}
                />
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

        {currentUserRole !== 'manager' && (d.top_clients || []).length > 0 && (
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

        {currentUserRole !== 'manager' && <ProfitChart chartOrders={d.chart_orders || []} period={period} />}

        {currentUserRole !== 'manager' && teamManagers.length > 0 && (
          <TeamBlock managers={teamManagers} onPress={(mgr: any) => {
            setTeamStatsPeriod(currentMonth());
            setTeamStatsUser(mgr);
          }} />
        )}
        </>) : (
          <ManagerView
            leads={leads}
            activityStats={activityStats}
            managers={teamManagers}
            setManagers={setTeamManagers}
            isAdmin={currentUserRole === 'admin'}
            currentUserId={currentUserId}
          />
        )}
      </View>
    </ScrollView>

    {/* Debtor orders modal */}
    <Modal
      visible={!!selectedDebtor}
      transparent
      animationType="slide"
      onRequestClose={() => setSelectedDebtor(null)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedDebtor(null)} />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedDebtor?.name}</Text>
              <Text style={styles.modalSub}>
                {selectedDebtor?.isCreditor ? 'Заявки с долгом перевозчику' : 'Заявки с долгом клиента'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedDebtor(null)} style={{ padding: 4 }}>
              <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {selectedDebtor && (
              selectedDebtor.isCreditor
                ? allOrders.filter(o => o.carrier_name === selectedDebtor.name && !o.carrier_paid && o.status !== 'cancelled')
                : allOrders.filter(o => o.client_name === selectedDebtor.name && !o.client_paid && o.status === 'delivered')
            ).map((o, i, arr) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.modalOrderRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => { setSelectedDebtor(null); router.push(`/order/${o.id}`); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOrderNum}>{o.order_number}</Text>
                  <Text style={styles.modalOrderRoute} numberOfLines={1}>{o.route_from} → {o.route_to}</Text>
                  <Text style={styles.modalOrderDate}>{o.unload_date || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.modalOrderAmt, { color: selectedDebtor.isCreditor ? theme.colors.loss : theme.colors.warning }]}>
                    {formatMoney(selectedDebtor.isCreditor ? o.carrier_rate : o.client_rate)}
                  </Text>
                  <ChevronRight size={14} color={theme.colors.textTertiary} strokeWidth={1.6} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Team stats modal */}
    <Modal visible={!!teamStatsUser} transparent animationType="slide" onRequestClose={() => setTeamStatsUser(null)}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setTeamStatsUser(null)} />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{teamStatsUser?.name}</Text>
              <Text style={styles.modalSub}>{teamStatsUser?.role === 'admin' ? 'Администратор' : teamStatsUser?.role === 'director' ? 'Директор' : 'Менеджер'}</Text>
            </View>
            <TouchableOpacity onPress={() => setTeamStatsUser(null)} style={{ padding: 4 }}>
              <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
          {/* Month picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
            {Array.from({ length: 6 }, (_, i) => {
              const d = new Date();
              d.setDate(1);
              d.setMonth(d.getMonth() - i);
              const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const lbl = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
              const active = ym === teamStatsPeriod;
              return (
                <TouchableOpacity key={ym} onPress={() => setTeamStatsPeriod(ym)} activeOpacity={0.7}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: active ? theme.colors.accent : theme.colors.surfaceElevated, borderWidth: 1, borderColor: active ? theme.colors.accent : theme.colors.border }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: active ? theme.colors.bg : theme.colors.textSecondary }}>{lbl}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {teamStatsLoading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 32 }} />
          ) : teamStatsData ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8 }}>
              {[
                { label: 'ЗАЯВКИ', value: teamStatsData.orders_created ?? '—', color: theme.colors.accent },
                { label: 'ЗВОНКИ', value: teamStatsData.calls_made ?? '—', color: theme.colors.info },
                { label: 'КОНВЕРСИЯ', value: `${teamStatsData.conversion ?? 0}%`, color: theme.colors.profit },
                { label: 'ВЫРУЧКА', value: formatMoney(teamStatsData.revenue_month ?? 0), color: theme.colors.accent },
              ].map(card => (
                <View key={card.label} style={{ flex: 1, minWidth: '40%', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 6 }}>{card.label}</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: card.color }}>{card.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>Нет данных</Text>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

function DebtRow({ item, color, last, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.debtRow, last && { borderBottomWidth: 0 }]} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.debtName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.debtMeta}>{item.orders} заявок</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[styles.debtAmount, { color }]}>{formatMoney(item.amount)}</Text>
        <ChevronRight size={14} color={theme.colors.textTertiary} strokeWidth={1.6} />
      </View>
    </TouchableOpacity>
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

function TeamBlock({ managers, onPress }: { managers: any[]; onPress: (mgr: any) => void }) {
  const visible = managers.filter(m => m.role !== 'admin' || managers.length <= 3);
  if (!visible.length) return null;
  return (
    <>
      <Text style={styles.sectionLabel}>КОМАНДА</Text>
      <View style={styles.listCard}>
        {managers.map((mgr, i) => (
          <TouchableOpacity key={mgr.id} onPress={() => onPress(mgr)} activeOpacity={0.7}
            style={[styles.debtRow, i === managers.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={mStyles.mgrAvatar}>
              <Text style={mStyles.mgrAvatarText}>{mgr.name[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.debtName} numberOfLines={1}>{mgr.name}</Text>
              <Text style={styles.debtMeta}>{mgr.role === 'admin' ? 'Администратор' : mgr.role === 'director' ? 'Директор' : 'Менеджер'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.accent }}>{mgr.orders_month} зая.</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>{mgr.calls_month} зв.</Text>
            </View>
            <ChevronRight size={14} color={theme.colors.textTertiary} strokeWidth={1.6} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

// Chart layout constants
const MAX_BAR_H = 164;
const VALUE_H = 16;   // space at top for value labels
const LABEL_H = 20;   // space at bottom for x-axis labels
const COL_H = MAX_BAR_H + VALUE_H + LABEL_H;  // 200
const BAR_BASE = VALUE_H + MAX_BAR_H;          // 180 — baseline Y from SVG top

// Minimum slot widths per column (bar + gap)
const MIN_SLOT_ALL = 40;   // single bar mode: ≥20px bar + 8px gap + rest
const MIN_SLOT_DAY = 52;   // paired bar mode: 2×20px bars + 4px inner + 8px outer

function ProfitChart({ chartOrders, period }: { chartOrders: any[]; period: string }) {
  const { width: screenW } = useWindowDimensions();

  if (!chartOrders?.length) return null;

  const orders = chartOrders
    .map(o => ({ date: o.d as string, profit: Math.max(0, (o.cr - o.car) * 0.8) }))
    .filter(o => !!o.date);

  if (!orders.length) return null;

  if (period === 'all') {
    const byMonth: Record<string, number> = {};
    orders.forEach(({ date, profit }) => {
      const ym = date.slice(0, 7);
      byMonth[ym] = (byMonth[ym] || 0) + profit;
    });
    const entries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) return null;
    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

    const n = entries.length;
    const GAP = 8;
    const totalW = Math.max(n * MIN_SLOT_ALL, screenW);
    const slotW = totalW / n;
    const barW = Math.max(20, slotW - GAP);

    const pts = entries.map(([, val], i) => {
      const barH = Math.max(2, (val / maxVal) * MAX_BAR_H);
      return { x: i * slotW + slotW / 2, y: BAR_BASE - barH, val };
    });

    return (
      <View style={cStyles.wrap}>
        <Text style={cStyles.header}>ПРИБЫЛЬ ПО ПЕРИОДАМ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width: totalW, height: COL_H }}>
            {entries.map(([ym, val], i) => {
              const barH = Math.max(2, (val / maxVal) * MAX_BAR_H);
              const barLeft = i * slotW + (slotW - barW) / 2;
              const label = MONTHS[parseInt(ym.slice(5), 10) - 1] || ym.slice(5);
              return (
                <React.Fragment key={ym}>
                  <View style={{ position: 'absolute', left: barLeft, bottom: LABEL_H, width: barW, height: barH, backgroundColor: theme.colors.accent, borderRadius: 4 }} />
                  <Text style={{ position: 'absolute', left: i * slotW, bottom: 0, width: slotW, textAlign: 'center', fontSize: 9, color: theme.colors.textTertiary }}>{label}</Text>
                </React.Fragment>
              );
            })}
            <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={totalW} height={COL_H}>
              {pts.length >= 2 && (
                <Polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} stroke={theme.colors.accent} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              )}
              {pts.map((p, i) => (
                <G key={i}>
                  <Circle cx={p.x} cy={p.y} r={3} fill={theme.colors.accent} />
                  <SvgText x={p.x} y={p.y - 5} textAnchor="middle" fontSize={8} fill={theme.colors.accent} fontWeight="600">
                    {formatShort(p.val)}
                  </SvgText>
                </G>
              ))}
            </Svg>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Specific month: paired bars with two lines
  const [y, m] = period.split('-').map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevPeriod = `${prevY}-${String(prevM).padStart(2, '0')}`;

  const currByDay: Record<number, number> = {};
  const prevByDay: Record<number, number> = {};
  orders.forEach(({ date, profit }) => {
    const ym = date.slice(0, 7);
    const day = parseInt(date.slice(8, 10), 10);
    if (ym === period) currByDay[day] = (currByDay[day] || 0) + profit;
    else if (ym === prevPeriod) prevByDay[day] = (prevByDay[day] || 0) + profit;
  });

  const days = Array.from(new Set([...Object.keys(currByDay), ...Object.keys(prevByDay)]))
    .map(Number).sort((a, b) => a - b);
  if (!days.length) return null;

  const maxVal = Math.max(...Object.values(currByDay), ...Object.values(prevByDay), 1);

  const n = days.length;
  const OUTER_GAP = 8, INNER_GAP = 4;
  const totalW = Math.max(n * MIN_SLOT_DAY, screenW);
  const slotW = totalW / n;
  const barHalf = Math.max(20, (slotW - OUTER_GAP - INNER_GAP) / 2);
  const pairW = barHalf * 2 + INNER_GAP;
  const padL = Math.max(0, (slotW - OUTER_GAP - pairW) / 2);

  const currPts = days.map((day, i) => {
    const barH = Math.max(2, ((currByDay[day] || 0) / maxVal) * MAX_BAR_H);
    return { x: i * slotW + padL + barHalf / 2, y: BAR_BASE - barH, val: currByDay[day] || 0 };
  });
  const prevPts = days.map((day, i) => {
    const barH = Math.max(2, ((prevByDay[day] || 0) / maxVal) * MAX_BAR_H);
    return { x: i * slotW + padL + barHalf + INNER_GAP + barHalf / 2, y: BAR_BASE - barH, val: prevByDay[day] || 0 };
  });

  return (
    <View style={cStyles.wrap}>
      <Text style={cStyles.header}>ПРИБЫЛЬ ПО ПЕРИОДАМ</Text>
      <View style={cStyles.legend}>
        <View style={[cStyles.dot, { backgroundColor: theme.colors.accent }]} />
        <Text style={cStyles.legendTxt}>Текущий</Text>
        <View style={[cStyles.dot, { backgroundColor: theme.colors.textSecondary }]} />
        <Text style={cStyles.legendTxt}>Прошлый</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: totalW, height: COL_H }}>
          {days.map((day, i) => {
            const ch = Math.max(2, ((currByDay[day] || 0) / maxVal) * MAX_BAR_H);
            const ph = Math.max(2, ((prevByDay[day] || 0) / maxVal) * MAX_BAR_H);
            return (
              <React.Fragment key={day}>
                <View style={{ position: 'absolute', left: i * slotW + padL, bottom: LABEL_H, width: barHalf, height: ch, backgroundColor: theme.colors.accent, borderRadius: 3 }} />
                <View style={{ position: 'absolute', left: i * slotW + padL + barHalf + INNER_GAP, bottom: LABEL_H, width: barHalf, height: ph, backgroundColor: theme.colors.textSecondary, borderRadius: 3 }} />
                <Text style={{ position: 'absolute', left: i * slotW, bottom: 0, width: slotW - OUTER_GAP, textAlign: 'center', fontSize: 9, color: theme.colors.textTertiary }}>{day}</Text>
              </React.Fragment>
            );
          })}
          <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={totalW} height={COL_H}>
            {currPts.length >= 2 && (
              <Polyline points={currPts.map(p => `${p.x},${p.y}`).join(' ')} stroke={theme.colors.accent} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            )}
            {prevPts.length >= 2 && (
              <Polyline points={prevPts.map(p => `${p.x},${p.y}`).join(' ')} stroke={theme.colors.textSecondary} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            )}
            {currPts.map((p, i) => (
              <G key={`c${i}`}>
                <Circle cx={p.x} cy={p.y} r={3} fill={theme.colors.accent} />
                <SvgText x={p.x} y={p.y - 5} textAnchor="middle" fontSize={8} fill={theme.colors.accent} fontWeight="600">
                  {p.val > 0 ? formatShort(p.val) : ''}
                </SvgText>
              </G>
            ))}
            {prevPts.map((p, i) => (
              <G key={`p${i}`}>
                <Circle cx={p.x} cy={p.y} r={3} fill={theme.colors.textSecondary} />
                <SvgText x={p.x} y={p.y - 5} textAnchor="middle" fontSize={8} fill={theme.colors.textSecondary} fontWeight="600">
                  {p.val > 0 ? formatShort(p.val) : ''}
                </SvgText>
              </G>
            ))}
          </Svg>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Manager View ─────────────────────────────────────────────────────────────

function ManagerView({ leads, activityStats, managers, setManagers, isAdmin, currentUserId }: {
  leads: any[]; activityStats: any[];
  managers: any[]; setManagers: (v: any[]) => void;
  isAdmin: boolean; currentUserId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().slice(0, 10);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [statsModalUser, setStatsModalUser] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState<'manager' | 'director'>('manager');
  const [newPermissions, setNewPermissions] = useState({ can_view_finance: false, can_view_all_orders: false, can_view_all_clients: false, can_view_all_leads: false, can_create_orders: true });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    if (isAdmin) {
      api.users.activitySummary().then(setManagers).catch(() => {});
    }
  }, [isAdmin]));

  const openManagerStats = async (mgr: any) => {
    setStatsModalUser(mgr);
    setStatsData(null);
    setActivityData(null);
    setStatsLoading(true);
    try {
      const [s, a] = await Promise.all([
        api.users.stats(mgr.id),
        api.users.activity(mgr.id).catch(() => null),
      ]);
      setStatsData(s);
      setActivityData(a);
    } catch {
      setStatsData(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const openEditUser = (mgr: any) => {
    setEditingUser(mgr);
    setNewName(mgr.name);
    setNewLogin(mgr.login);
    setNewPassword('');
    setNewRole(mgr.role === 'director' ? 'director' : 'manager');
    setNewPermissions({
      can_view_finance: !!(mgr.permissions?.can_view_finance),
      can_view_all_orders: !!(mgr.permissions?.can_view_all_orders),
      can_view_all_clients: !!(mgr.permissions?.can_view_all_clients),
      can_view_all_leads: !!(mgr.permissions?.can_view_all_leads),
      can_create_orders: mgr.permissions?.can_create_orders !== false,
    });
    setAddModalVisible(true);
  };

  const saveUser = async () => {
    if (!newName.trim() || !newLogin.trim() || (!editingUser && !newPassword.trim())) {
      Alert.alert('Заполните обязательные поля');
      return;
    }
    setCreating(true);
    try {
      if (editingUser) {
        await api.users.update(editingUser.id, {
          name: newName.trim(), login: newLogin.trim(),
          ...(newPassword ? { password: newPassword } : {}),
          ...(editingUser.id !== currentUserId ? { role: newRole, permissions: newPermissions } : {}),
        });
        const refreshed = await api.users.activitySummary();
        setManagers(refreshed);
      } else {
        const mgr = await api.users.create({ name: newName.trim(), login: newLogin.trim(), password: newPassword, role: newRole, permissions: newPermissions });
        setManagers(prev => [...prev, mgr]);
      }
      setAddModalVisible(false);
      setEditingUser(null);
      setNewName(''); setNewLogin(''); setNewPassword('');
      setNewRole('manager');
      setNewPermissions({ can_view_finance: false, can_view_all_orders: false, can_view_all_clients: false, can_view_all_leads: false, can_create_orders: true });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить');
    } finally {
      setCreating(false);
    }
  };

  const deleteManager = (mgr: any) => {
    Alert.alert('Удалить менеджера?', mgr.name, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.users.delete(mgr.id).catch(() => {});
        setManagers(prev => prev.filter(m => m.id !== mgr.id));
      }},
    ]);
  };

  const todayCalls = leads.filter(l => l.next_call === today && l.status !== 'won' && l.status !== 'lost');
  const overdue = leads.filter(l => l.next_call && l.next_call < today && l.status !== 'won' && l.status !== 'lost');
  const callNow = [
    ...overdue.slice().sort((a, b) => a.next_call.localeCompare(b.next_call)),
    ...todayCalls,
  ];
  const total = leads.length;
  const wonCount = leads.filter(l => l.status === 'won').length;
  const convRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

  const funnelRows = [
    { key: 'new',      label: 'Новые' },
    { key: 'thinking', label: 'Думают' },
    { key: 'sent_kp',  label: 'Выслал КП' },
    { key: 'callback', label: 'Перезвонить' },
    { key: 'won',      label: 'Клиенты' },
    { key: 'lost',     label: 'Потеряны' },
  ].map(s => ({ ...s, count: leads.filter(l => l.status === s.key).length, color: leadStatusColors[s.key] }));

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d.toISOString().slice(0, 10);
  });
  const actMap = Object.fromEntries(activityStats.map(s => [s.date, s.count]));
  const weekAct = last7.map(date => ({ date, count: actMap[date] || 0, day: parseInt(date.slice(8, 10), 10) }));

  const top5 = [...leads]
    .filter(l => l.last_contact)
    .sort((a, b) => b.last_contact.localeCompare(a.last_contact))
    .slice(0, 5);

  return (
    <>
      <View style={mStyles.summaryRow}>
        <View style={mStyles.summaryCard}>
          <Text style={mStyles.summaryLabel}>КОНВЕРСИЯ</Text>
          <Text style={[mStyles.summaryValue, { color: theme.colors.profit }]}>{convRate}%</Text>
          <Text style={mStyles.summarySub}>{wonCount} из {total}</Text>
        </View>
        <View style={mStyles.summaryCard}>
          <Text style={mStyles.summaryLabel}>СЕГОДНЯ</Text>
          <Text style={[mStyles.summaryValue, { color: todayCalls.length > 0 ? theme.colors.accent : theme.colors.textTertiary }]}>{todayCalls.length}</Text>
          <Text style={mStyles.summarySub}>звонков</Text>
        </View>
        <View style={[mStyles.summaryCard, overdue.length > 0 && { borderColor: theme.colors.loss + '60' }]}>
          <Text style={mStyles.summaryLabel}>ПРОСРОЧЕНО</Text>
          <Text style={[mStyles.summaryValue, { color: overdue.length > 0 ? theme.colors.loss : theme.colors.textTertiary }]}>{overdue.length}</Text>
          <Text style={mStyles.summarySub}>перезвонов</Text>
        </View>
      </View>

      <Text style={mStyles.sectionLabel}>ВОРОНКА ОБЗВОНА</Text>
      <View style={mStyles.funnelCard}>
        {funnelRows.map(s => {
          const pct = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <View key={s.key} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={mStyles.barLabel}>{s.label}</Text>
                <Text style={[mStyles.barCount, { color: s.color || theme.colors.textTertiary }]}>{s.count}</Text>
              </View>
              <View style={mStyles.barBg}>
                <View style={[mStyles.barFill, { width: `${pct}%`, backgroundColor: s.color || theme.colors.accent }]} />
              </View>
            </View>
          );
        })}
      </View>

      <Text style={mStyles.sectionLabel}>АКТИВНОСТЬ — 7 ДНЕЙ</Text>
      <View style={mStyles.actCard}>
        {weekAct.map(({ date, count, day }, i) => (
          <View key={date} style={[mStyles.actCol, i < weekAct.length - 1 && { borderRightWidth: 1, borderRightColor: theme.colors.border }]}>
            <Text style={[mStyles.actNum, { color: count > 0 ? theme.colors.accent : theme.colors.textTertiary }]}>{count}</Text>
            <Text style={mStyles.actDate}>{day}</Text>
          </View>
        ))}
      </View>

      {callNow.length > 0 && (
        <>
          <Text style={mStyles.sectionLabel}>ПЕРЕЗВОНИТЬ СЕЙЧАС</Text>
          <View style={mStyles.listCard}>
            {callNow.map((l, i) => {
              const isOverdue = l.next_call < today;
              const accent = isOverdue ? theme.colors.loss : theme.colors.warning;
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => router.push(`/lead/${l.id}` as any)}
                  style={[mStyles.callNowRow, i === callNow.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.7}
                >
                  <View style={[mStyles.callNowBar, { backgroundColor: accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.leadName} numberOfLines={1}>{l.name}</Text>
                    {!!l.company && <Text style={mStyles.leadMeta} numberOfLines={1}>{l.company}</Text>}
                    <Text style={[mStyles.callNowDate, { color: accent }]}>
                      {isOverdue ? `Просрочено: ${l.next_call}` : 'Сегодня'}
                    </Text>
                  </View>
                  <Text style={[mStyles.leadPhone, { color: accent }]}>{l.phone}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {top5.length > 0 && (
        <>
          <Text style={mStyles.sectionLabel}>ПОСЛЕДНЯЯ АКТИВНОСТЬ</Text>
          <View style={mStyles.listCard}>
            {top5.map((l, i) => (
              <TouchableOpacity key={l.id} onPress={() => router.push(`/lead/${l.id}` as any)} style={[mStyles.leadRow, i === top5.length - 1 && { borderBottomWidth: 0 }]} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={mStyles.leadName} numberOfLines={1}>{l.name}</Text>
                  {!!l.company && <Text style={mStyles.leadMeta} numberOfLines={1}>{l.company}</Text>}
                </View>
                <Text style={mStyles.leadDate}>{l.last_contact}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {isAdmin && (
        <>
          <View style={mStyles.mgrHeader}>
            <Text style={mStyles.sectionLabel}>МЕНЕДЖЕРЫ</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(true)} style={mStyles.addBtn} activeOpacity={0.7}>
              <UserPlus size={14} color={theme.colors.accent} strokeWidth={1.8} />
              <Text style={mStyles.addBtnText}>Добавить</Text>
            </TouchableOpacity>
          </View>
          {managers.length > 0 && (
            <View style={mStyles.listCard}>
              {managers.map((mgr, i) => (
                <TouchableOpacity
                  key={mgr.id}
                  onPress={() => openManagerStats(mgr)}
                  onLongPress={() => deleteManager(mgr)}
                  style={[mStyles.mgrRow, i === managers.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.7}
                >
                  <View style={mStyles.mgrAvatar}>
                    <Text style={mStyles.mgrAvatarText}>{mgr.name[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.leadName}>{mgr.name}</Text>
                    <Text style={mStyles.leadMeta}>{mgr.role === 'admin' ? 'Администратор' : mgr.role === 'director' ? 'Директор' : 'Менеджер'} · {mgr.login}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openEditUser(mgr)} style={mStyles.editBtn} activeOpacity={0.7}>
                    <Text style={mStyles.editBtnText}>Ред.</Text>
                  </TouchableOpacity>
                  <ChevronRight size={14} color={theme.colors.textTertiary} strokeWidth={1.6} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Add Manager Modal */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => { setAddModalVisible(false); setEditingUser(null); }}>
        <View style={mStyles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setAddModalVisible(false); setEditingUser(null); }} />
          <View style={[mStyles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={mStyles.modalHeaderRow}>
              <Text style={mStyles.modalTitle}>{editingUser ? 'Редактировать' : 'Новый менеджер'}</Text>
              <TouchableOpacity onPress={() => { setAddModalVisible(false); setEditingUser(null); }} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                <View style={mStyles.inputWrap}>
                  <Text style={mStyles.inputLabel}>ИМЯ</Text>
                  <TextInput style={mStyles.input} value={newName} onChangeText={setNewName} placeholder="Иван Иванов" placeholderTextColor={theme.colors.textTertiary} />
                </View>
                <View style={mStyles.inputWrap}>
                  <Text style={mStyles.inputLabel}>ЛОГИН</Text>
                  <TextInput style={mStyles.input} value={newLogin} onChangeText={setNewLogin} autoCapitalize="none" placeholder="ivanov" placeholderTextColor={theme.colors.textTertiary} />
                </View>
                <View style={mStyles.inputWrap}>
                  <Text style={mStyles.inputLabel}>{editingUser ? 'НОВЫЙ ПАРОЛЬ (необязательно)' : 'ПАРОЛЬ'}</Text>
                  <TextInput style={mStyles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={theme.colors.textTertiary} />
                </View>
                {(!editingUser || editingUser.id !== currentUserId) && (
                <View style={mStyles.inputWrap}>
                  <Text style={mStyles.inputLabel}>РОЛЬ</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['manager', 'director'] as const).map(r => (
                      <TouchableOpacity key={r} onPress={() => setNewRole(r)} activeOpacity={0.7}
                        style={[mStyles.roleBtn, newRole === r && mStyles.roleBtnActive]}>
                        <Text style={[mStyles.roleBtnText, newRole === r && mStyles.roleBtnTextActive]}>
                          {r === 'manager' ? 'Менеджер' : 'Директор'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                )}
                {(!editingUser || editingUser.id !== currentUserId) && (
                <View style={mStyles.inputWrap}>
                  <Text style={mStyles.inputLabel}>ПРАВА ДОСТУПА</Text>
                  {([
                    { key: 'can_view_finance', label: 'Видеть финансы' },
                    { key: 'can_view_all_orders', label: 'Видеть все заявки' },
                    { key: 'can_view_all_clients', label: 'Видеть всех клиентов' },
                    { key: 'can_view_all_leads', label: 'Видеть все лиды' },
                    { key: 'can_create_orders', label: 'Создавать заявки' },
                  ] as { key: keyof typeof newPermissions; label: string }[]).map(p => (
                    <View key={p.key} style={mStyles.permRow}>
                      <Text style={mStyles.permLabel}>{p.label}</Text>
                      <Switch
                        value={newPermissions[p.key]}
                        onValueChange={v => setNewPermissions(prev => ({ ...prev, [p.key]: v }))}
                        trackColor={{ false: theme.colors.surfaceElevated, true: theme.colors.accent + '60' }}
                        thumbColor={newPermissions[p.key] ? theme.colors.accent : theme.colors.textTertiary}
                      />
                    </View>
                  ))}
                </View>
                )}
                <TouchableOpacity onPress={saveUser} disabled={creating} style={[mStyles.createBtn, creating && { opacity: 0.6 }]} activeOpacity={0.8}>
                  {creating ? <ActivityIndicator color={theme.colors.bg} /> : <Text style={mStyles.createBtnText}>{editingUser ? 'Сохранить' : 'Создать'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manager Stats Modal */}
      <Modal visible={!!statsModalUser} transparent animationType="slide" onRequestClose={() => setStatsModalUser(null)}>
        <View style={mStyles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setStatsModalUser(null)} />
          <View style={[mStyles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={mStyles.modalHeaderRow}>
              <Text style={mStyles.modalTitle}>{statsModalUser?.name}</Text>
              <TouchableOpacity onPress={() => setStatsModalUser(null)} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            {statsLoading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 32 }} />
            ) : statsData ? (
              <>
                <View style={mStyles.statsGrid}>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>ЗАЯВКИ МЕС.</Text>
                    <Text style={mStyles.statCardValue}>{activityData?.orders_month ?? '—'}</Text>
                  </View>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>ЗВОНКИ (30 дн.)</Text>
                    <Text style={mStyles.statCardValue}>{activityData?.calls_total ?? '—'}</Text>
                  </View>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>КОНВЕРСИЯ</Text>
                    <Text style={[mStyles.statCardValue, { color: theme.colors.profit }]}>{activityData?.conversion ?? statsData.conversion}%</Text>
                  </View>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>ВЫРУЧКА МЕС.</Text>
                    <Text style={[mStyles.statCardValue, { color: theme.colors.accent, fontSize: 16 }]}>{formatMoney(statsData.revenue_month)}</Text>
                  </View>
                </View>
                {activityData?.activity_chart?.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={mStyles.statCardLabel}>АКТИВНОСТЬ ПО ДНЯМ</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8, height: 40 }}>
                      {activityData.activity_chart.slice(-14).map((item: any) => {
                        const maxC = Math.max(...activityData.activity_chart.map((x: any) => x.count), 1);
                        const h = Math.max(4, (item.count / maxC) * 36);
                        return (
                          <View key={item.date} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{ width: '100%', height: h, backgroundColor: theme.colors.accent, borderRadius: 2 }} />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>Нет данных</Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const mStyles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12,
  },
  summaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary },
  summaryValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  summarySub: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 1 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 10, marginTop: 8 },

  funnelCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16, marginBottom: 16 },
  barLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  barCount: { fontSize: 13, fontWeight: '700' },
  barBg: { height: 4, backgroundColor: theme.colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },

  actCard: {
    flexDirection: 'row', height: 80,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, marginBottom: 16, overflow: 'hidden',
  },
  actCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actNum: { fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  actDate: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },

  listCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, marginBottom: 16, paddingHorizontal: 16 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  leadName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '500' },
  leadMeta: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  leadPhone: { color: theme.colors.accent, fontSize: 12, fontWeight: '600' },
  leadDate: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' },

  callNowRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingLeft: 0,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  callNowBar: { width: 3, height: 38, borderRadius: 2, flexShrink: 0 },
  callNowDate: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  mgrHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.accent + '15', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.accent + '40' },
  addBtnText: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  mgrRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  mgrAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  mgrAvatarText: { color: theme.colors.accent, fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  modalSheet: { backgroundColor: theme.colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingHorizontal: 20 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: theme.colors.textPrimary, fontSize: 14 },
  createBtn: { backgroundColor: theme.colors.accent, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  createBtnText: { color: theme.colors.bg, fontSize: 14, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8 },
  statCard: { flex: 1, minWidth: '40%', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  statCardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 6 },
  statCardValue: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary },

  editBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: theme.colors.accent + '15', borderRadius: 7, borderWidth: 1, borderColor: theme.colors.accent + '40', marginRight: 6 },
  editBtnText: { color: theme.colors.accent, fontSize: 11, fontWeight: '700' },

  roleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border },
  roleBtnActive: { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.textTertiary },
  roleBtnTextActive: { color: theme.colors.accent, fontWeight: '700' },

  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  permLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500', flex: 1 },
});

const cStyles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingTop: 16,
    paddingBottom: 4,
    paddingHorizontal: 0,
    marginHorizontal: -20,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 16, paddingHorizontal: 20 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 10, color: theme.colors.textTertiary, marginRight: 8 },
});

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
  logoutBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 6 },
  title: { fontSize: 34, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary, marginBottom: 16 },

  modeToggle: {
    flexDirection: 'row', marginBottom: 14,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  modeBtnActive: { backgroundColor: theme.colors.surface },
  modeBtnText: { color: theme.colors.textTertiary, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: theme.colors.textPrimary, fontWeight: '700' },

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

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  modalTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
  modalSub: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  modalOrderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalOrderNum: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },
  modalOrderRoute: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  modalOrderDate: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  modalOrderAmt: { fontSize: 14, fontWeight: '700', minWidth: 80, textAlign: 'right' },

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
