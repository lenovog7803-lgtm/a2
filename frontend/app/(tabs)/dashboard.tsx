import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, Switch, useWindowDimensions, Modal, TextInput, Platform } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, withSpring, useSharedValue, interpolate, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle as SvgCircle, Rect as SvgRect, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight, ArrowDownCircle, ArrowUpCircle, Briefcase, DollarSign, Clock, CheckCircle, Wallet, Users, Truck, RefreshCw, CheckCircle2, AlertTriangle, Sun, Moon, Link2, LogIn, LogOut, ChevronRight, X, UserPlus, Trash2, Search, Bell, Calendar, ChevronDown } from 'lucide-react-native';
import { theme, formatMoney, formatShort, leadStatusColors, leadStatusLabels } from '../../src/theme';
import { useTheme } from '../../src/themeContext';
import { GlassCard } from '../../src/components/GlassCard';
import { api } from '../../src/api';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROLE_KEY } from '../../src/auth';
import AnalyticsTab from '../../src/components/AnalyticsTab';
import { MiniChart } from '../../src/components/MiniChart';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const periodOptions = [
  { id: 'all', label: 'Все время', dividerAfter: true },
  { id: '2026-06', label: 'Июнь 2026' },
  { id: '2026-05', label: 'Май 2026' },
  { id: '2026-04', label: 'Апр 2026' },
  { id: '2026-03', label: 'Мар 2026' },
  { id: '2026-02', label: 'Фев 2026' },
  { id: '2026-01', label: 'Янв 2026', dividerAfter: true },
  { id: '2025-12', label: 'Дек 2025' },
  { id: '2025-11', label: 'Ноя 2025' },
  { id: '2025-10', label: 'Окт 2025' },
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  delivered: 'Доставлено',
  cancelled: 'Отменено',
};

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
  const [dashView, setDashView] = useState<'dashboard' | 'manager' | 'analytics'>('dashboard');
  const [leads, setLeads] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState<any[]>([]);
  const [teamManagers, setTeamManagers] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [teamStatsUser, setTeamStatsUser] = useState<any>(null);
  const [teamStatsData, setTeamStatsData] = useState<any>(null);
  const [teamStatsPeriod, setTeamStatsPeriod] = useState<string>(currentMonth());
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);
  const [teamStatsOrders, setTeamStatsOrders] = useState<any[]>([]);
  const [teamStatsLeads, setTeamStatsLeads] = useState<any[]>([]);

  // Global search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showClientDebtors, setShowClientDebtors] = useState(false);
  const [showCarrierDebtors, setShowCarrierDebtors] = useState(false);
  const [showAllTopClients, setShowAllTopClients] = useState(false);
  const [showAllTopMargin, setShowAllTopMargin] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<any>(null);
  const searchWidth = useSharedValue(36);
  const searchOpacity = useSharedValue(0);
  const tabsOpacity = useSharedValue(1);
  const searchAnimStyle = useAnimatedStyle(() => ({ width: searchWidth.value }));
  const inputStyle = useAnimatedStyle(() => ({ opacity: searchOpacity.value }));
  const tabsStyle = useAnimatedStyle(() => ({ opacity: tabsOpacity.value, flex: 1 }));
  const openSearch = () => {
    setSearchOpen(true);
    searchWidth.value = withSpring(220, { damping: 20, stiffness: 200 });
    searchOpacity.value = withTiming(1, { duration: 200 });
    tabsOpacity.value = withTiming(0, { duration: 150 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    searchWidth.value = withSpring(36, { damping: 20, stiffness: 200 });
    searchOpacity.value = withTiming(0, { duration: 150 });
    tabsOpacity.value = withTiming(1, { duration: 200 });
    searchInputRef.current?.blur();
  };
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [dayModalData, setDayModalData] = useState<any>(null);
  const [dayModalLoading, setDayModalLoading] = useState(false);
  const [debtorOrdersDebtor, setDebtorOrdersDebtor] = useState<{ name: string; isCreditor: boolean } | null>(null);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try { setSearchResults(await api.globalSearch(searchQuery)); }
      catch { setSearchResults(null); }
      finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  useEffect(() => {
    if (!dayModalDate) { setDayModalData(null); return; }
    setDayModalLoading(true);
    api.dayOrders(dayModalDate)
      .then(setDayModalData)
      .catch(() => setDayModalData(null))
      .finally(() => setDayModalLoading(false));
  }, [dayModalDate]);

  // Получим начальный статус импорта
  useEffect(() => {
    api.sync.importStatus().then(setImportStatus).catch(() => {});
    api.auth.googleStatus().then(setAuthStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!teamStatsUser) return;
    setTeamStatsLoading(true);
    setTeamStatsData(null);
    setTeamStatsOrders([]);
    setTeamStatsLeads([]);
    Promise.all([
      api.users.stats(teamStatsUser.id, teamStatsPeriod),
      api.users.orders(teamStatsUser.id, teamStatsPeriod).catch(() => []),
      api.users.leads(teamStatsUser.id).catch(() => []),
    ])
      .then(([stats, orders, leads]) => {
        setTeamStatsData(stats);
        setTeamStatsOrders(orders as any[]);
        setTeamStatsLeads(leads as any[]);
      })
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
  const totalMargin = d.total_margin || 0;
  const totalProfit = d.profit || 0;
  const clientDebt = d.unpaid_by_clients || 0;
  const carrierDebt = d.owed_to_carriers || 0;
  const clientDebtors = (d.debtors || []).map((c: any) => ({ name: c.name, count: c.orders, debt: c.amount, id: c.id }));
  const carrierDebtors = (d.creditors || []).map((c: any) => ({ name: c.name, count: c.orders, debt: c.amount, id: c.id }));
  const activeOrders = d.active_orders || 0;
  const doneOrders = d.delivered_orders || 0;
  const clientsCount = d.clients_count || 0;
  const carriersCount = d.carriers_count || 0;
  const topClients = d.top_clients || [];
  const topByMargin = d.top_clients_margin || [];
  const selectedPeriodLabel = periodOptions.find(o => o.id === period)?.label ?? monthLabel(period) ?? 'Период';
  const prevMonthMargin: number = d.prev_margin ?? 0;
  const marginChangePct: number | null = d.margin_change_pct ?? null;
  const prevMonthLabel = d.prev_period ? monthLabel(d.prev_period) : null;
  const marginChangeIsPositive = (marginChangePct ?? 0) >= 0;

  return (
    <>
    <ScrollView
      testID="dashboard-screen"
      style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : theme.colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        load(period);
      }} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}
    >
      <View style={{ paddingHorizontal: 16 }}>
        {/* === HEADER: icon-search + tabs + period === */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: insets.top + 8, paddingBottom: 12 }}>

          {/* Search: starts as 36px icon, springs open to 220px */}
          <Animated.View style={[searchAnimStyle, { height: 34, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: searchOpen ? theme.colors.accent : theme.colors.border, flexDirection: 'row', alignItems: 'center' }]}>
            <TouchableOpacity onPress={searchOpen ? undefined : openSearch} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Search size={15} color={searchOpen ? theme.colors.accent : theme.colors.textSecondary} strokeWidth={1.8} />
            </TouchableOpacity>
            <Animated.View style={[inputStyle, { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }]}>
              <TextInput
                ref={searchInputRef}
                autoFocus={searchOpen}
                placeholder="Поиск по CRM..."
                placeholderTextColor={theme.colors.textTertiary}
                style={{ flex: 1, fontSize: 12, color: theme.colors.textPrimary, padding: 0 }}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity onPress={closeSearch}>
                <X size={13} color={theme.colors.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Tabs — flex:1, fade out when search opens */}
          <Animated.View style={[tabsStyle, { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: 10, padding: 2, borderWidth: 0.5, borderColor: theme.colors.border }]}>
            {([
              { key: 'dashboard' as const, label: 'Обзор' },
              { key: 'manager' as const, label: 'Команда' },
              { key: 'analytics' as const, label: 'Цели' },
            ]).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => { setDashView(tab.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', backgroundColor: dashView === tab.key ? theme.colors.accent : 'transparent' }}
                activeOpacity={0.8}
              >
                <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={{ fontSize: 12, fontWeight: dashView === tab.key ? '600' : '400', color: dashView === tab.key ? '#fff' : theme.colors.textSecondary }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Period */}
          <TouchableOpacity
            onPress={() => { setPeriodOpen(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.9}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 0.5, borderColor: theme.colors.border, height: 34 }}
          >
            <Calendar size={12} color={theme.colors.textTertiary} strokeWidth={1.5} />
            <Text numberOfLines={1} style={{ fontSize: 11, color: theme.colors.textPrimary }}>{selectedPeriodLabel}</Text>
            <ChevronDown size={11} color={theme.colors.textTertiary} strokeWidth={1.5} />
          </TouchableOpacity>

          {/* Theme + logout (always visible) */}
          <TouchableOpacity onPress={() => toggleTheme()} activeOpacity={0.8} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }} testID="theme-toggle">
            {mode === 'dark' ? <Sun size={13} color={theme.colors.accent} strokeWidth={1.5} /> : <Moon size={13} color={theme.colors.textSecondary} strokeWidth={1.5} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => logout(router)} activeOpacity={0.8} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }} testID="logout-btn">
            <LogOut size={13} color={theme.colors.loss} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        {/* Inline search results */}
        {searchOpen && searchQuery.length >= 2 && (
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: 14, borderWidth: 0.5, borderColor: theme.colors.border, marginBottom: 10, maxHeight: 320, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 }}>
            {searchLoading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 20 }} />
            ) : searchResults ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                {searchResults.orders?.slice(0, 5).map((o: any) => (
                  <TouchableOpacity key={o.id} onPress={() => { closeSearch(); router.push(`/order/${o.id}` as any); }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.accent }}>{o.order_number}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.textTertiary }} numberOfLines={1}>{o.client_name}</Text>
                    </View>
                    <ChevronRight size={13} color={theme.colors.textTertiary} strokeWidth={1.5} />
                  </TouchableOpacity>
                ))}
                {searchResults.clients?.slice(0, 3).map((c: any) => (
                  <TouchableOpacity key={c.id} onPress={() => { closeSearch(); router.push(`/client/${c.id}` as any); }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
                    <Text style={{ flex: 1, fontSize: 13, color: theme.colors.textPrimary }} numberOfLines={1}>{c.company_name || c.name}</Text>
                    <ChevronRight size={13} color={theme.colors.textTertiary} strokeWidth={1.5} />
                  </TouchableOpacity>
                ))}
                {searchResults.leads?.slice(0, 3).map((l: any) => (
                  <TouchableOpacity key={l.id} onPress={() => { closeSearch(); router.push(`/lead/${l.id}` as any); }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: theme.colors.textPrimary }} numberOfLines={1}>{l.name}</Text>
                      {!!l.company && <Text style={{ fontSize: 11, color: theme.colors.textTertiary }} numberOfLines={1}>{l.company}</Text>}
                    </View>
                    <ChevronRight size={13} color={theme.colors.textTertiary} strokeWidth={1.5} />
                  </TouchableOpacity>
                ))}
                {!searchResults.orders?.length && !searchResults.clients?.length && !searchResults.leads?.length && (
                  <Text style={{ color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 20, fontSize: 13 }}>Ничего не найдено</Text>
                )}
              </ScrollView>
            ) : null}
          </View>
        )}

        {dashView === 'dashboard' ? (<>

          {/* === BLOCK 1: Two-column cards === */}
          {currentUserRole !== 'manager' && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>

              {/* Left: dark navy — margin + profit (new design) */}
              <LinearGradient
                colors={['#0E1726', '#243049', '#3A4A6B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ flex: 1, borderRadius: 22, padding: 20, justifyContent: 'space-between', overflow: 'hidden' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.1, color: 'rgba(255,255,255,0.55)' }}>МАРЖА ЗА ПЕРИОД</Text>
                  {marginChangePct !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: marginChangeIsPositive ? 'rgba(94,232,155,0.18)' : 'rgba(224,71,59,0.18)', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 }}>
                      {marginChangeIsPositive
                        ? <TrendingUp size={11} color="#5BE89B" strokeWidth={2.2} />
                        : <TrendingDown size={11} color="#FF6B6B" strokeWidth={2.2} />}
                      <Text style={{ fontSize: 11, fontWeight: '700', color: marginChangeIsPositive ? '#5BE89B' : '#FF6B6B' }}>
                        {marginChangeIsPositive ? '+' : ''}{marginChangePct.toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -1, marginTop: 12, lineHeight: 36 }}>
                  {totalMargin.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} Br
                </Text>
                <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 14 }} />
                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <View>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Выручка</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 3 }}>
                      {(d.total_revenue || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} Br
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Прибыль (–20%)</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#5BE89B', marginTop: 3 }}>
                      {totalProfit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} Br
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Right column */}
              <View style={{ flex: 1, gap: 10 }}>

                {/* Orange/cream: awaiting from clients */}
                <PressableGradient colors={['rgba(255,236,214,0.95)', 'rgba(255,213,170,0.85)', 'rgba(252,220,170,0.9)']} onPress={() => setShowClientDebtors(true)} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.06, color: '#A86A20' }}>ОЖИДАЕТСЯ</Text>
                    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={12} color="#D97706" strokeWidth={1.8} />
                    </View>
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#7A4A12', letterSpacing: -0.5, marginTop: 5 }}>
                      {clientDebt.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} Br
                    </Text>
                    <Text style={{ fontSize: 9, color: '#A86A20', fontWeight: '500', marginTop: 2 }}>{clientDebtors.length} · к получению</Text>
                  </View>
                </PressableGradient>

                {/* Purple: to pay carriers */}
                <PressableGradient colors={['rgba(224,224,255,0.95)', 'rgba(208,191,255,0.85)', 'rgba(208,191,255,0.9)']} onPress={() => setShowCarrierDebtors(true)} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.06, color: '#6B3FB8' }}>К ОПЛАТЕ</Text>
                    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={12} color="#7C3AED" strokeWidth={1.8} />
                    </View>
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#4A2785', letterSpacing: -0.5, marginTop: 5 }}>
                      {carrierDebt.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} Br
                    </Text>
                    <Text style={{ fontSize: 9, color: '#6B3FB8', fontWeight: '500', marginTop: 2 }}>{carrierDebtors.length} · к выплате</Text>
                  </View>
                </PressableGradient>

                {/* Stats chips */}
                <GlassCard padding={11} borderRadius={18} style={{ flexDirection: 'row' } as any}>
                  {[
                    { val: activeOrders, label: 'Активных', color: '#D97706' },
                    { val: doneOrders, label: 'Доставлено', color: '#1E9E5A' },
                    { val: clientsCount, label: 'Клиентов', color: '#1366F0' },
                    { val: carriersCount, label: 'Перевозч.', color: '#7C3AED' },
                  ].map((item, i, arr) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < arr.length - 1 ? 0.5 : 0, borderRightColor: theme.colors.borderInner }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: item.color }}>{item.val}</Text>
                      <Text style={{ fontSize: 9, color: theme.colors.textTertiary, marginTop: 2 }}>{item.label}</Text>
                    </View>
                  ))}
                </GlassCard>
              </View>
            </View>
          )}

          {/* === BLOCK 2: Chart === */}
          {currentUserRole !== 'manager' && (
            <ProfitChart
              chartOrders={d.chart_orders || []}
              period={period}
              onDayPress={(date) => setDayModalDate(date)}
            />
          )}

          {/* === BLOCK 3: Top clients + Top margin === */}
          {currentUserRole !== 'manager' && (topClients.length > 0 || topByMargin.length > 0) && (
            <View style={{ flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 12, marginBottom: 12 }}>
              {topClients.length > 0 && (
                <GlassCard padding={16} borderRadius={20} style={{ flex: 1 } as any}>
                  <Text style={{ fontSize: 13, fontFamily: 'Onest_700Bold', color: theme.colors.textPrimary, marginBottom: 2 }}>Топ клиентов</Text>
                  <Text style={{ fontSize: 10, color: theme.colors.textTertiary, marginBottom: 10 }}>по выручке</Text>
                  {topClients.slice(0, 5).map((client: any, i: number) => (
                    <TouchableOpacity key={i} onPress={() => setShowAllTopClients(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: i < Math.min(topClients.length, 5) - 1 ? 0.5 : 0, borderBottomColor: theme.colors.border }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: '500', color: theme.colors.accent }}>{i + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 11, color: theme.colors.textPrimary }} numberOfLines={1}>{client.name}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: theme.colors.accent }}>
                        {(client.revenue / 1000).toFixed(0)}K Br
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => setShowAllTopClients(true)}>
                    <Text style={{ fontSize: 11, color: theme.colors.accent, marginTop: 8 }}>Все клиенты →</Text>
                  </TouchableOpacity>
                </GlassCard>
              )}

              {topByMargin.length > 0 && (
                <GlassCard padding={16} borderRadius={20} style={{ flex: 1 } as any}>
                  <Text style={{ fontSize: 13, fontFamily: 'Onest_700Bold', color: theme.colors.textPrimary, marginBottom: 2 }}>Топ по марже</Text>
                  <Text style={{ fontSize: 10, color: theme.colors.textTertiary, marginBottom: 10 }}>% маржинальности</Text>
                  {topByMargin.slice(0, 5).map((client: any, i: number) => (
                    <TouchableOpacity key={i} onPress={() => setShowAllTopMargin(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: i < Math.min(topByMargin.length, 5) - 1 ? 0.5 : 0, borderBottomColor: theme.colors.border }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: '500', color: '#1E9E5A' }}>{i + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 11, color: theme.colors.textPrimary }} numberOfLines={1}>{client.name}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: '#1E9E5A' }}>
                        {(client.margin_percent || 0).toFixed(1)}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => setShowAllTopMargin(true)}>
                    <Text style={{ fontSize: 11, color: '#1E9E5A', marginTop: 8 }}>Все по марже →</Text>
                  </TouchableOpacity>
                </GlassCard>
              )}
            </View>
          )}

          {/* Team */}
          {currentUserRole !== 'manager' && teamManagers.length > 0 && (
            <TeamBlock managers={teamManagers} onPress={(mgr: any) => {
              setTeamStatsPeriod(currentMonth());
              setTeamStatsUser(mgr);
            }} />
          )}

        </>) : dashView === 'manager' ? (
          <ManagerView
            leads={leads}
            activityStats={activityStats}
            managers={teamManagers}
            setManagers={setTeamManagers}
            isAdmin={currentUserRole === 'admin'}
            currentUserId={currentUserId}
          />
        ) : (
          <AnalyticsTab />
        )}
      </View>
    </ScrollView>

    {/* Period dropdown — rendered outside ScrollView to avoid clipping */}
    {periodOpen && (
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPeriodOpen(false)} activeOpacity={1} />
    )}
    {periodOpen && (
      <View style={{ position: 'absolute', top: insets.top + 58, left: 192, backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: theme.colors.border, zIndex: 200, minWidth: 162, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 }}>
        {periodOptions.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            onPress={() => { setPeriod(opt.id); setPeriodOpen(false); }}
            style={{ paddingHorizontal: 13, paddingVertical: 9, borderBottomWidth: (opt as any).dividerAfter ? 0.5 : 0, borderBottomColor: theme.colors.border }}
          >
            <Text style={{ fontSize: 12, color: period === opt.id ? theme.colors.accent : theme.colors.textPrimary, fontWeight: period === opt.id ? '500' : '400' }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    )}

    {/* Debtor orders modal (selectedDebtor) */}
    <ExpandModal
      visible={!!selectedDebtor}
      onClose={() => setSelectedDebtor(null)}
      title={selectedDebtor?.name || ''}
      subtitle={selectedDebtor?.isCreditor ? 'Заявки с долгом перевозчику' : 'Заявки с долгом клиента'}
    >
      <ScrollView style={{ maxHeight: 400, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
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
    </ExpandModal>

    {/* Team stats modal */}
    <ExpandModal
      visible={!!teamStatsUser}
      onClose={() => setTeamStatsUser(null)}
      title={teamStatsUser?.name || ''}
      subtitle={teamStatsUser?.role === 'admin' ? 'Администратор' : teamStatsUser?.role === 'director' ? 'Директор' : 'Менеджер'}
    >
      <View style={{ paddingHorizontal: 20 }}>
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
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
            {teamStatsData ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 12 }}>
                  {[
                    { label: 'ЗАЯВКИ', value: teamStatsData.orders_created ?? '—', color: theme.colors.accent },
                    { label: 'ЗВОНКИ', value: teamStatsData.calls_made ?? '—', color: theme.colors.info },
                    { label: 'ЛИДЫ', value: teamStatsData.total_leads ?? '—', color: theme.colors.info },
                    { label: 'КОНВЕРСИЯ', value: `${teamStatsData.conversion ?? 0}%`, color: theme.colors.profit },
                    { label: 'ВЫРУЧКА', value: formatMoney(teamStatsData.revenue_month ?? 0), color: theme.colors.accent },
                  ].map(card => (
                    <View key={card.label} style={{ flex: 1, minWidth: '40%', backgroundColor: theme.colors.surfaceElevated, borderWidth: 0.5, borderColor: theme.colors.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 6 }}>{card.label}</Text>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: card.color }}>{card.value}</Text>
                    </View>
                  ))}
                </View>
                {teamStatsOrders.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 8 }]}>ЗАЯВКИ ЗА МЕСЯЦ</Text>
                    <View style={styles.listCard}>
                      {teamStatsOrders.map((o: any, i: number) => (
                        <TouchableOpacity key={o.id} activeOpacity={0.7}
                          onPress={() => { setTeamStatsUser(null); router.push(`/order/${o.id}` as any); }}
                          style={[styles.modalOrderRow, i === teamStatsOrders.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalOrderNum}>{o.order_number}</Text>
                            <Text style={styles.modalOrderRoute} numberOfLines={1}>{o.client_name}</Text>
                            <Text style={styles.modalOrderDate} numberOfLines={1}>{o.route_from} → {o.route_to}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={[styles.modalOrderAmt, { color: theme.colors.accent }]}>{formatMoney(o.client_rate)}</Text>
                            <Text style={{ fontSize: 10, color: theme.colors.textTertiary }}>{ORDER_STATUS_LABELS[o.status] || o.status}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {teamStatsLeads.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 8 }]}>ЛИДЫ</Text>
                    <View style={styles.listCard}>
                      {teamStatsLeads.map((l: any, i: number) => (
                        <TouchableOpacity key={l.id} activeOpacity={0.7}
                          onPress={() => { setTeamStatsUser(null); router.push(`/lead/${l.id}` as any); }}
                          style={[styles.debtRow, i === teamStatsLeads.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.debtName} numberOfLines={1}>{l.name}</Text>
                            {!!l.company && <Text style={styles.debtMeta} numberOfLines={1}>{l.company}</Text>}
                            {!!l.last_contact && <Text style={styles.debtMeta}>{l.last_contact}</Text>}
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: leadStatusColors[l.status] || theme.colors.textTertiary }}>
                            {leadStatusLabels[l.status] || l.status}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            ) : (
              <Text style={{ color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>Нет данных</Text>
            )}
          </ScrollView>
        )}
      </View>
    </ExpandModal>

    {/* Client debtors modal */}
    <ExpandModal visible={showClientDebtors} onClose={() => setShowClientDebtors(false)} title="Должники — клиенты">
      <FlatList
        data={clientDebtors}
        keyExtractor={(item) => item.name}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        renderItem={({ item }: any) => (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDebtorOrdersDebtor({ name: item.name, isCreditor: false }); }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{item.name}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{item.count} заявок</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#D97706' }}>{(item.debt || 0).toLocaleString()} Br</Text>
              <ChevronRight size={14} color={theme.colors.textTertiary} strokeWidth={1.5} />
            </View>
          </TouchableOpacity>
        )}
      />
    </ExpandModal>

    {/* Carrier debtors modal */}
    <ExpandModal visible={showCarrierDebtors} onClose={() => setShowCarrierDebtors(false)} title="К оплате — перевозчики">
      <FlatList
        data={carrierDebtors}
        keyExtractor={(item) => item.name}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        renderItem={({ item }: any) => (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDebtorOrdersDebtor({ name: item.name, isCreditor: true }); }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{item.name}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{item.count} заявок</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#7C3AED' }}>{(item.debt || 0).toLocaleString()} Br</Text>
              <ChevronRight size={14} color={theme.colors.textTertiary} strokeWidth={1.5} />
            </View>
          </TouchableOpacity>
        )}
      />
    </ExpandModal>

    {/* Debtor orders nested modal */}
    <ExpandModal
      visible={!!debtorOrdersDebtor}
      onClose={() => setDebtorOrdersDebtor(null)}
      title={debtorOrdersDebtor?.name || ''}
      subtitle={debtorOrdersDebtor?.isCreditor ? 'Заявки к оплате перевозчику' : 'Неоплаченные заявки клиента'}
    >
      <FlatList
        data={allOrders.filter(o =>
          debtorOrdersDebtor?.isCreditor
            ? o.carrier_name === debtorOrdersDebtor?.name && !o.carrier_paid && o.status !== 'cancelled'
            : o.client_name === debtorOrdersDebtor?.name && !o.client_paid && o.status === 'delivered'
        )}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        ListEmptyComponent={<Text style={{ color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>Нет заявок</Text>}
        renderItem={({ item }: any) => (
          <TouchableOpacity
            onPress={() => { setDebtorOrdersDebtor(null); setShowClientDebtors(false); setShowCarrierDebtors(false); router.push(`/order/${item.id}` as any); }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border, gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.accent }}>{item.order_number}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{item.route_from} → {item.route_to}</Text>
              {item.unload_date && <Text style={{ fontSize: 10, color: theme.colors.textTertiary, marginTop: 1 }}>{item.unload_date}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: debtorOrdersDebtor?.isCreditor ? '#7C3AED' : '#D97706' }}>
                {formatMoney(debtorOrdersDebtor?.isCreditor ? item.carrier_rate : item.client_rate)}
              </Text>
              <ChevronRight size={13} color={theme.colors.textTertiary} strokeWidth={1.5} />
            </View>
          </TouchableOpacity>
        )}
      />
    </ExpandModal>

    {/* Day orders modal */}
    <ExpandModal
      visible={!!dayModalDate}
      onClose={() => setDayModalDate(null)}
      title={dayModalDate || ''}
      subtitle={dayModalData ? `${dayModalData.orders_count} заявок · прибыль ${formatMoney(dayModalData.total_margin)}` : undefined}
    >
      {dayModalLoading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 32 }} />
      ) : (
        <FlatList
          data={dayModalData?.orders || []}
          keyExtractor={(item: any) => item.order_number}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          ListEmptyComponent={<Text style={{ color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>Нет заявок за этот день</Text>}
          renderItem={({ item }: any) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border, gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.accent }}>{item.order_number}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{item.client_name}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: item.margin >= 0 ? theme.colors.profit : theme.colors.loss }}>
                {formatMoney(item.margin)}
              </Text>
            </View>
          )}
        />
      )}
    </ExpandModal>

    {/* Top clients modal */}
    <ExpandModal visible={showAllTopClients} onClose={() => setShowAllTopClients(false)} title="Топ клиентов">
      <FlatList
        data={d.top_clients || []}
        keyExtractor={(item: any) => item.name}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        renderItem={({ item, index }: any) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border, gap: 12 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.accent }}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{item.orders_count} заявок</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary }}>{(item.revenue / 1000).toFixed(0)}K Br</Text>
          </View>
        )}
      />
    </ExpandModal>

    {/* Top margin modal */}
    <ExpandModal visible={showAllTopMargin} onClose={() => setShowAllTopMargin(false)} title="Топ по марже">
      <FlatList
        data={d.top_clients_margin || []}
        keyExtractor={(item: any) => item.name}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        renderItem={({ item }: any) => (
          <View style={{ paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, flex: 1 }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: item.margin >= 0 ? theme.colors.profit : theme.colors.loss, marginLeft: 8 }}>
                {(item.margin / 1000).toFixed(0)}K Br
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, height: 4, backgroundColor: theme.colors.surfaceHigh, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ height: 4, backgroundColor: theme.colors.accent, borderRadius: 2, width: `${Math.min(item.margin_percent || 0, 100)}%` as any }} />
              </View>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, width: 40, textAlign: 'right' }}>{(item.margin_percent || 0).toFixed(1)}%</Text>
            </View>
          </View>
        )}
      />
    </ExpandModal>
    </>
  );
}

// ─── PressableCard ────────────────────────────────────────────────────────────

// ─── PressableGradient ────────────────────────────────────────────────────────

function PressableGradient({ colors, onPress, children, style }: { colors: string[]; onPress?: () => void; children: React.ReactNode; style?: any }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, style]}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress?.(); }}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
        activeOpacity={1}
      >
        <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 14, minHeight: 95, justifyContent: 'space-between' }}>
          {children}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── ExpandModal ──────────────────────────────────────────────────────────────

function ExpandModal({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(500);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, { damping: 26, stiffness: 220, mass: 0.8 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(500, { duration: 280 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }, overlayStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[sheetStyle, {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: theme.colors.glassStrong,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingBottom: insets.bottom + 20,
        maxHeight: '88%',
        borderWidth: 1, borderColor: theme.colors.glassBorder,
        shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.2, shadowRadius: 24, elevation: 24,
      }]}>
        <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderInner, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderInner }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary }} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 }}>{subtitle}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
            <X size={14} color={theme.colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

// ─── DebtRow ──────────────────────────────────────────────────────────────────

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

function MiniStatCard({ label, value, icon: Icon, color }: any) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    }}>
      <View style={{ backgroundColor: color + '15', borderRadius: 8, padding: 6, alignSelf: 'flex-start', marginBottom: 10 }}>
        <Icon size={16} color={color} strokeWidth={2} />
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function StatCard({ gradient, accentColor, label, value, sub, icon: Icon, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 20,
          padding: 18,
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ backgroundColor: accentColor + '20', borderRadius: 10, padding: 8 }}>
            <Icon size={18} color={accentColor} strokeWidth={2} />
          </View>
        </View>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.5 }}>{value}</Text>
        <Text style={{ fontSize: 12, color: '#6B6B7B', marginTop: 2, fontWeight: '500' }}>{label}</Text>
        {sub && <Text style={{ fontSize: 11, color: accentColor, marginTop: 4, fontWeight: '600' }}>{sub}</Text>}
      </LinearGradient>
    </TouchableOpacity>
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
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.accent }}>{mgr.orders_total ?? mgr.orders_month} зая.</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>{mgr.calls_month} зв.</Text>
            </View>
            <ChevronRight size={14} color={theme.colors.textTertiary} strokeWidth={1.6} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

function ProfitChart({ chartOrders, period, onDayPress }: { chartOrders: any[]; period: string; onDayPress?: (date: string) => void }) {
  const { width: screenW } = useWindowDimensions();
  const W = screenW - 64;
  const H = 110;
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number; count: number } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
    if (entries.length < 2) return null;
    const chartData = entries.map(([, v]) => v);
    const chartLabels = entries.map(([ym]) => MONTHS[parseInt(ym.slice(5), 10) - 1]);

    return (
      <View style={cStyles.chartCard}>
        <Text style={cStyles.header}>Прибыль по периодам</Text>
        <Text style={cStyles.headerSub}>По месяцам</Text>
        <MiniChart data={chartData} width={W} height={110} color="#1366F0" showTooltip labels={chartLabels} />
      </View>
    );
  }

  const [pY, pM] = period.split('-').map(Number);
  const prevY = pM === 1 ? pY - 1 : pY;
  const prevM = pM === 1 ? 12 : pM - 1;
  const prevPeriod = `${prevY}-${String(prevM).padStart(2, '0')}`;
  const monthName = MONTHS[pM - 1];
  const isCurrentMonth = period === currentMonth();
  const todayDay = new Date().getDate();
  const daysInMonth = new Date(pY, pM, 0).getDate();

  const currByDay: Record<number, number> = {};
  const prevByDay: Record<number, number> = {};
  orders.forEach(({ date, profit }) => {
    const ym = date.slice(0, 7);
    const day = parseInt(date.slice(8, 10), 10);
    if (ym === period) currByDay[day] = (currByDay[day] || 0) + profit;
    else if (ym === prevPeriod) prevByDay[day] = (prevByDay[day] || 0) + profit;
  });

  // Build day-indexed arrays for current+prev month
  const currentData = Array.from({ length: daysInMonth }, (_, i) => currByDay[i + 1] || 0);
  const prevData = Array.from({ length: daysInMonth }, (_, i) => prevByDay[i + 1] || 0);
  if (currentData.every(v => v === 0) && prevData.every(v => v === 0)) return null;

  const CHART_H = 120;
  const LEFT_PAD = 38;
  const maxVal = Math.max(...currentData, ...prevData, 1);
  const yTicks = [0, Math.round(maxVal * 0.5 / 100) * 100, Math.round(maxVal / 100) * 100];

  const toPoints = (data: number[]) => data.map((v, i) => ({
    x: LEFT_PAD + (i / Math.max(data.length - 1, 1)) * (W - LEFT_PAD - 8),
    y: 10 + (1 - v / (yTicks[2] || 1)) * (CHART_H - 30),
  }));

  const curPts = toPoints(currentData);
  const prvPts = toPoints(prevData);

  const effectiveToday = isCurrentMonth ? todayDay - 1 : daysInMonth - 1;

  const getSegOpacity = (i: number) => {
    if (hoveredIndex === null) return i <= effectiveToday ? 1 : 0.22;
    const dist = Math.min(Math.abs(i - hoveredIndex), Math.abs(i - 1 - hoveredIndex));
    if (dist === 0) return 1;
    if (dist === 1) return 0.55;
    if (dist === 2) return 0.28;
    return 0.08;
  };

  const getPtOpacity = (i: number) => {
    if (hoveredIndex === null) return i <= effectiveToday ? 1 : 0.18;
    const dist = Math.abs(i - hoveredIndex);
    if (dist === 0) return 1;
    if (dist === 1) return 0.5;
    if (dist === 2) return 0.22;
    return 0.06;
  };

  const prvPathStr = (() => {
    if (prvPts.length < 2) return '';
    let d = `M${prvPts[0].x},${prvPts[0].y}`;
    for (let i = 1; i < prvPts.length; i++) {
      const cpx = (prvPts[i - 1].x + prvPts[i].x) / 2;
      d += ` C${cpx},${prvPts[i - 1].y} ${cpx},${prvPts[i].y} ${prvPts[i].x},${prvPts[i].y}`;
    }
    return d;
  })();

  const segPath = (p1: any, p2: any) => {
    const cpx = (p1.x + p2.x) / 2;
    return `M${p1.x},${p1.y} C${cpx},${p1.y} ${cpx},${p2.y} ${p2.x},${p2.y}`;
  };

  const colW = W / Math.max(curPts.length, 1);

  return (
    <View style={cStyles.chartCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={cStyles.header}>Прибыль по периодам</Text>
        <Text style={cStyles.headerSub}>vs прошлый месяц</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 18, height: 2.5, borderRadius: 2, backgroundColor: '#1366F0' }} />
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Этот период</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 18, height: 2.5, borderRadius: 2, backgroundColor: '#f87171' }} />
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Прошлый</Text>
        </View>
      </View>

      <View style={{ position: 'relative' }}>
        <Svg width={W} height={CHART_H} style={{ overflow: 'visible' }}>
          {/* Y-grid */}
          {yTicks.map((tick, ti) => {
            const ty = 10 + (1 - tick / (yTicks[2] || 1)) * (CHART_H - 30);
            return (
              <React.Fragment key={ti}>
                <SvgLine x1={LEFT_PAD} y1={ty} x2={W - 4} y2={ty} stroke={theme.colors.border} strokeWidth={0.5} strokeDasharray="3,4" />
                <SvgText x={LEFT_PAD - 4} y={ty + 3.5} fontSize={9} fill={theme.colors.textTertiary} textAnchor="end">
                  {tick >= 1000 ? `${(tick / 1000).toFixed(0)}K` : String(tick)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Previous period line */}
          <Path d={prvPathStr} stroke="#f87171" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={hoveredIndex !== null ? 0.12 : 0.45} />

          {/* Current period segments (spotlight opacity) */}
          {curPts.map((pt, i) => {
            if (i === 0) return null;
            return <Path key={i} d={segPath(curPts[i - 1], pt)} stroke="#1366F0" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={getSegOpacity(i)} />;
          })}

          {/* Vertical cursor line */}
          {hoveredIndex !== null && curPts[hoveredIndex] && (
            <SvgLine x1={curPts[hoveredIndex].x} y1={10} x2={curPts[hoveredIndex].x} y2={CHART_H - 20} stroke="#1366F0" strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
          )}

          {/* Points */}
          {curPts.map((pt, i) => {
            const isToday = isCurrentMonth && i + 1 === todayDay;
            const isHov = hoveredIndex === i;
            const op = getPtOpacity(i);
            return (
              <React.Fragment key={i}>
                {isToday && hoveredIndex === null && (
                  <>
                    <SvgCircle cx={pt.x} cy={pt.y} r={10} fill="#1366F0" opacity={0.08} />
                    <SvgCircle cx={pt.x} cy={pt.y} r={5} fill="#1366F0" opacity={0.9} />
                    <SvgCircle cx={pt.x} cy={pt.y} r={2.5} fill="#fff" />
                    <SvgText x={pt.x} y={CHART_H - 2} fontSize={8} fill="#1366F0" textAnchor="middle" fontWeight="600">Сег.</SvgText>
                  </>
                )}
                {isHov && (
                  <>
                    <SvgCircle cx={pt.x} cy={pt.y} r={14} fill="#1366F0" opacity={0.08} />
                    <SvgCircle cx={pt.x} cy={pt.y} r={8} fill="#1366F0" opacity={0.15} />
                    <SvgCircle cx={pt.x} cy={pt.y} r={5} fill="#1366F0" />
                    <SvgCircle cx={pt.x} cy={pt.y} r={2.5} fill="#fff" />
                  </>
                )}
                {!isToday && !isHov && op > 0.1 && (
                  <SvgCircle cx={pt.x} cy={pt.y} r={2.5} fill="#1366F0" opacity={op} />
                )}
                {/* Hit area */}
                <SvgRect
                  x={pt.x - colW / 2}
                  y={0}
                  width={colW}
                  height={CHART_H}
                  fill="transparent"
                  onPressIn={() => {
                    setHoveredIndex(i);
                    setTooltip({ x: pt.x, y: pt.y, label: `${i + 1} ${monthName}`, value: currentData[i], count: 0 });
                    if (Haptics.selectionAsync) Haptics.selectionAsync();
                    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  onPressOut={() => {
                    setHoveredIndex(null);
                    setTooltip(null);
                    onDayPress?.(`${period}-${String(i + 1).padStart(2, '0')}`);
                  }}
                  {...(Platform.OS === 'web' ? {
                    onMouseEnter: () => { setHoveredIndex(i); setTooltip({ x: pt.x, y: pt.y, label: `${i + 1} ${monthName}`, value: currentData[i], count: 0 }); },
                    onMouseLeave: () => { setHoveredIndex(null); setTooltip(null); },
                  } : {})}
                />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Tooltip */}
        {tooltip && (
          <View style={{ position: 'absolute', left: Math.max(4, Math.min(tooltip.x - 52, W - 110)), top: tooltip.y - 62, backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, zIndex: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 2 }}>{tooltip.label}</Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{tooltip.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} Br</Text>
          </View>
        )}
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingLeft: LEFT_PAD, paddingRight: 4 }}>
        {currentData.map((_, i) => (
          i % Math.ceil(currentData.length / 8) === 0 ? (
            <Text key={i} style={{ fontSize: 9, color: hoveredIndex === i ? theme.colors.accent : theme.colors.textTertiary, fontWeight: hoveredIndex === i ? '600' : '400' }}>
              {i + 1}
            </Text>
          ) : <View key={i} />
        ))}
      </View>
    </View>
  );
}

// ─── Manager View ─────────────────────────────────────────────────────────────

function ManagerView({ leads, activityStats, managers, setManagers, isAdmin, currentUserId }: {
  leads: any[]; activityStats: any[];
  managers: any[]; setManagers: React.Dispatch<React.SetStateAction<any[]>>;
  isAdmin: boolean; currentUserId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().slice(0, 10);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [statsModalUser, setStatsModalUser] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsMonth, setStatsMonth] = useState<string>(currentMonth());
  const [statsOrders, setStatsOrders] = useState<any[]>([]);
  const [statsLeads, setStatsLeads] = useState<any[]>([]);
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

  const openManagerStats = (mgr: any) => {
    setStatsMonth(currentMonth());
    setStatsModalUser(mgr);
  };

  useEffect(() => {
    if (!statsModalUser) return;
    setStatsLoading(true);
    setStatsData(null);
    setActivityData(null);
    setStatsOrders([]);
    setStatsLeads([]);
    Promise.all([
      api.users.stats(statsModalUser.id, statsMonth),
      api.users.activity(statsModalUser.id).catch(() => null),
      api.users.orders(statsModalUser.id, statsMonth).catch(() => []),
      api.users.leads(statsModalUser.id).catch(() => []),
    ])
      .then(([s, a, orders, leads]) => {
        setStatsData(s);
        setActivityData(a);
        setStatsOrders(orders as any[]);
        setStatsLeads(leads as any[]);
      })
      .catch(() => setStatsData(null))
      .finally(() => setStatsLoading(false));
  }, [statsModalUser, statsMonth]);

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
          <View style={[mStyles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24), maxHeight: '90%' }]}>
            <View style={mStyles.modalHeaderRow}>
              <Text style={mStyles.modalTitle}>{statsModalUser?.name}</Text>
              <TouchableOpacity onPress={() => setStatsModalUser(null)} style={{ padding: 4 }}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            {/* Month selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
              {Array.from({ length: 6 }, (_, i) => {
                const dd = new Date();
                dd.setDate(1);
                dd.setMonth(dd.getMonth() - i);
                const ym = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`;
                const lbl = `${MONTHS[dd.getMonth()]} ${dd.getFullYear()}`;
                const active = ym === statsMonth;
                return (
                  <TouchableOpacity key={ym} onPress={() => setStatsMonth(ym)} activeOpacity={0.7}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: active ? theme.colors.accent : theme.colors.surfaceElevated, borderWidth: 1, borderColor: active ? theme.colors.accent : theme.colors.border }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? theme.colors.bg : theme.colors.textSecondary }}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {statsLoading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 32 }} />
            ) : statsData ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={mStyles.statsGrid}>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>ЗАЯВКИ МЕС.</Text>
                    <Text style={mStyles.statCardValue}>{statsData.orders_created ?? '—'}</Text>
                  </View>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>ЗВОНКИ</Text>
                    <Text style={mStyles.statCardValue}>{statsData.calls_made ?? '—'}</Text>
                  </View>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>ЛИДЫ</Text>
                    <Text style={mStyles.statCardValue}>{statsData.total_leads ?? '—'}</Text>
                  </View>
                  <View style={mStyles.statCard}>
                    <Text style={mStyles.statCardLabel}>КОНВЕРСИЯ</Text>
                    <Text style={[mStyles.statCardValue, { color: theme.colors.profit }]}>{statsData.conversion ?? 0}%</Text>
                  </View>
                  <View style={[mStyles.statCard, { minWidth: '100%' }]}>
                    <Text style={mStyles.statCardLabel}>ВЫРУЧКА МЕС.</Text>
                    <Text style={[mStyles.statCardValue, { color: theme.colors.accent, fontSize: 20 }]}>{formatMoney(statsData.revenue_month)}</Text>
                  </View>
                </View>
                {statsOrders.length > 0 && (
                  <>
                    <Text style={[mStyles.sectionLabel, { marginTop: 12 }]}>ЗАЯВКИ ЗА МЕСЯЦ</Text>
                    <View style={mStyles.listCard}>
                      {statsOrders.map((o: any, i: number) => (
                        <TouchableOpacity key={o.id} activeOpacity={0.7}
                          onPress={() => { setStatsModalUser(null); router.push(`/order/${o.id}` as any); }}
                          style={[mStyles.leadRow, i === statsOrders.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[mStyles.leadName, { color: theme.colors.accent }]}>{o.order_number}</Text>
                            <Text style={mStyles.leadMeta} numberOfLines={1}>{o.client_name}</Text>
                            <Text style={mStyles.leadMeta} numberOfLines={1}>{o.route_from} → {o.route_to}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 3 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.accent }}>{formatMoney(o.client_rate)}</Text>
                            <Text style={{ fontSize: 10, color: theme.colors.textTertiary }}>{ORDER_STATUS_LABELS[o.status] || o.status}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {statsLeads.length > 0 && (
                  <>
                    <Text style={[mStyles.sectionLabel, { marginTop: 4 }]}>ЛИДЫ</Text>
                    <View style={mStyles.listCard}>
                      {statsLeads.map((l: any, i: number) => (
                        <TouchableOpacity key={l.id} activeOpacity={0.7}
                          onPress={() => { setStatsModalUser(null); router.push(`/lead/${l.id}` as any); }}
                          style={[mStyles.leadRow, i === statsLeads.length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={mStyles.leadName} numberOfLines={1}>{l.name}</Text>
                            {!!l.company && <Text style={mStyles.leadMeta} numberOfLines={1}>{l.company}</Text>}
                            {!!l.last_contact && <Text style={mStyles.leadMeta}>{l.last_contact}</Text>}
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: leadStatusColors[l.status] || theme.colors.textTertiary }}>
                            {leadStatusLabels[l.status] || l.status}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>
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
    flex: 1, backgroundColor: theme.colors.glass,
    borderWidth: 1, borderColor: theme.colors.glassBorder, borderRadius: 14, padding: 13,
    shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 3,
  },
  summaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary },
  summaryValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  summarySub: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 1 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 10, marginTop: 8 },

  funnelCard: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.glassBorder, borderRadius: 18, padding: 16, marginBottom: 16, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3 },
  barLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  barCount: { fontSize: 13, fontWeight: '700' },
  barBg: { height: 4, backgroundColor: theme.colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },

  actCard: {
    flexDirection: 'row', height: 80,
    backgroundColor: theme.colors.glass,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
    borderRadius: 18, marginBottom: 16, overflow: 'hidden',
    shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  actCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actNum: { fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  actDate: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },

  listCard: { backgroundColor: theme.colors.glass, borderRadius: 18, marginBottom: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: theme.colors.glassBorder, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 3 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.borderInner },
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
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
  },
  header: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary, marginBottom: 4 },
  headerSub: { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 12 },
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  themeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: theme.colors.glass,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
    borderRadius: 999,
  },
  logoutBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.glass,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 6 },
  title: { fontSize: 34, fontFamily: 'Onest_700Bold', letterSpacing: -0.5, color: theme.colors.textPrimary, marginBottom: 16 },

  modeToggle: {
    flexDirection: 'row', marginBottom: 14,
    backgroundColor: theme.colors.glass,
    borderRadius: 12, padding: 3,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
  },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  modeBtnActive: { backgroundColor: theme.colors.glassStrong },
  modeBtnText: { color: theme.colors.textTertiary, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: theme.colors.textPrimary, fontWeight: '700' },

  // Search bar
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 0.5, borderColor: theme.colors.border,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: theme.colors.textTertiary },

  // Three-card row
  leftCard: {
    flex: 1.5, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '500' },
  bigValue: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.3, marginTop: 3 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },
  gradientCard: {
    flex: 1, borderRadius: 20, padding: 14, justifyContent: 'space-between',
  },
  gradCardIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  gradCardLabel: { fontSize: 10, color: 'rgba(0,0,0,0.55)', fontWeight: '500', marginTop: 8 },
  gradCardValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.3, marginTop: 2 },
  gradCardSub: { fontSize: 10, color: 'rgba(0,0,0,0.45)', marginTop: 2 },

  // Stats chips row
  statsRow: {
    flexDirection: 'row', backgroundColor: theme.colors.surface,
    borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 0.5, borderColor: theme.colors.border,
  },
  statChip: {
    flex: 1, alignItems: 'center',
    borderRightWidth: 0.5, borderRightColor: theme.colors.border, paddingVertical: 2,
  },
  statChipValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statChipLabel: { fontSize: 10, color: theme.colors.textSecondary, marginTop: 2, textAlign: 'center' },

  // Section cards (top clients / margin)
  sectionCard: {
    backgroundColor: theme.colors.surface, borderRadius: 16,
    padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: theme.colors.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  sectionLink: { fontSize: 13, color: theme.colors.accent, fontWeight: '600' },

  // Top clients
  topClientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border,
  },
  topClientNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.accent + '15', alignItems: 'center', justifyContent: 'center',
  },
  topClientNumText: { fontSize: 11, fontWeight: '700', color: theme.colors.accent },
  topClientName: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  topClientSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  topClientValue: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },

  // Margin bars
  marginRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  marginName: { fontSize: 12, color: theme.colors.textPrimary, width: 90 },
  marginBarWrap: { flex: 1, height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' },
  marginBar: { height: 6, backgroundColor: '#1366F0', borderRadius: 3 },
  marginPct: { fontSize: 11, color: theme.colors.textSecondary, width: 40, textAlign: 'right' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statTile: { width: '48%', flexGrow: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 14, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 8, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, color: theme.colors.textTertiary, marginTop: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 10, marginTop: 8 },
  listCard: { backgroundColor: theme.colors.surface, borderRadius: 16, marginBottom: 16, paddingHorizontal: 16, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  debtName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '500' },
  debtMeta: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  debtAmount: { fontSize: 14, fontWeight: '700' },

  statusCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  statusLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  statusValue: { fontSize: 13, fontWeight: '700' },
  bgBar: { height: 4, backgroundColor: theme.colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  bgFill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: 2 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  topRankCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.accent + '20', borderWidth: 1, borderColor: theme.colors.accent + '40', alignItems: 'center', justifyContent: 'center' },
  topRank: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  topName: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 2 },
  topRevenue: { color: theme.colors.accent, fontSize: 13, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  marginBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignItems: 'center' },
  marginBadgeTxt: { fontSize: 10, fontWeight: '800' },

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
  syncCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
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
