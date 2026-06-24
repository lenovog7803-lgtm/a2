import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, RefreshCw, ArrowRight } from 'lucide-react-native';
import { api } from '../../src/api';

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const monthLabel = (ym: string) => { if(!ym) return ym; const [y,m] = ym.split('-'); return `${MONTHS[parseInt(m,10)-1]} ${y}`; };
const fmt = (n: number) => Math.round(n||0).toLocaleString('ru-RU');
const fmtShort = (n: number) => n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e3 ? Math.round(n/1e3)+'K' : String(Math.round(n));

const PERIOD_OPTIONS = [
  { id:'all', label:'Все время' },
  { id:'2026-06', label:'Июнь 2026' }, { id:'2026-05', label:'Май 2026' },
  { id:'2026-04', label:'Апр 2026' },  { id:'2026-03', label:'Мар 2026' },
  { id:'2026-02', label:'Фев 2026' },  { id:'2026-01', label:'Янв 2026' },
  { id:'2025-12', label:'Дек 2025' },  { id:'2025-11', label:'Ноя 2025' },
];

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  new:         { color:'#1366F0', bg:'rgba(19,102,240,0.12)',  label:'Новая' },
  in_progress: { color:'#D97706', bg:'rgba(217,119,6,0.14)',   label:'В работе' },
  delivered:   { color:'#1E9E5A', bg:'rgba(30,158,90,0.14)',   label:'Доставлено' },
  cancelled:   { color:'#E0473B', bg:'rgba(224,71,59,0.12)',   label:'Отменено' },
};

const GRADIENTS = [
  ['#FFD8A8','#FF922B'], ['#D0BFFF','#7C3AED'], ['#A5D8FF','#1366F0'],
  ['#B2F2BB','#1E9E5A'], ['#FFC9C9','#E0473B'], ['#99E9F2','#0CA6C0'],
];
const avatarIdx = (name: string) => name.split('').reduce((a,c) => a+c.charCodeAt(0), 0) % GRADIENTS.length;
const initials = (name: string) => {
  const clean = (name||'').replace(/^(ООО|АО|ОАО|ЗАО|ТД|ИП|ПАО)\s+/i,'').trim();
  const w = clean.split(/[\s-]+/).filter(Boolean);
  return ((w[0]?.[0]||'')+(w[1]?.[0]||w[0]?.[1]||'')).toUpperCase();
};

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(currentMonth());
  const [showPeriod, setShowPeriod] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, ords] = await Promise.all([
        api.dashboard(period).catch(() => ({})),
        api.orders.list().catch(() => []),
      ]);
      setData(dash);
      setOrders(ords);
    } catch {} finally { setLoading(false); }
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const d = data || {};
  const allOrders = orders;
  const nonCancelled = allOrders.filter((o: any) => o.status !== 'cancelled');
  const sum = (arr: any[], f: (o: any) => number) => arr.reduce((a, o) => a + f(o), 0);
  const totalMargin = d.total_margin ?? sum(nonCancelled, o => Number(o.margin ?? (Number(o.client_rate)-Number(o.carrier_rate))));
  const totalRevenue = d.total_revenue ?? sum(nonCancelled, o => Number(o.client_rate));
  const incomeReceived = d.income_received ?? sum(allOrders.filter((o:any) => o.client_paid), o => Number(o.client_rate));
  const expensesPaid = d.expenses_paid ?? sum(allOrders.filter((o:any) => o.carrier_paid), o => Number(o.carrier_rate));
  const clientDebt = d.client_debt ?? sum(allOrders.filter((o:any) => o.status==='delivered'&&!o.client_paid), o => Number(o.client_rate));
  const carrierDebt = d.carrier_debt ?? sum(allOrders.filter((o:any) => o.status!=='cancelled'&&!o.carrier_paid), o => Number(o.carrier_rate));
  const activeCount = allOrders.filter((o:any) => o.status==='new'||o.status==='in_progress').length;
  const doneCount = allOrders.filter((o:any) => o.status==='delivered').length;

  // top clients by revenue
  const byClient: Record<string, any> = {};
  nonCancelled.forEach((o: any) => {
    const k = o.client_name || o.clientName || '';
    if (!byClient[k]) byClient[k] = { rev:0, cnt:0 };
    byClient[k].rev += Number(o.client_rate||0);
    byClient[k].cnt++;
  });
  const topClients = Object.entries(byClient)
    .sort(([,a],[,b]) => b.rev - a.rev).slice(0,5)
    .map(([name, v]: any) => ({ name, rev: v.rev, cnt: v.cnt }));

  // debtors
  const dc: Record<string,number> = {};
  allOrders.filter((o:any) => o.status==='delivered'&&!o.client_paid).forEach((o:any) => {
    const k = o.client_name||o.clientName||'';
    dc[k] = (dc[k]||0)+Number(o.client_rate||0);
  });
  const debtors = Object.entries(dc).map(([name, amt]) => ({ name, amt })).sort((a,b)=>b.amt-a.amt);

  if (loading) return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.center}>
      <ActivityIndicator color="#1366F0" size="large" />
    </ScrollView>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Дашборд</Text>
        <View style={{ flex: 1 }} />
        {/* Period picker */}
        <View style={{ position: 'relative' as any }}>
          <TouchableOpacity style={styles.periodBtn} onPress={() => setShowPeriod(v=>!v)}>
            <Text style={styles.periodBtnText}>{period==='all'?'Все время':monthLabel(period)}</Text>
          </TouchableOpacity>
          {showPeriod && (
            <View style={styles.periodDropdown}>
              {PERIOD_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.id} style={[styles.periodOpt, period===opt.id && styles.periodOptActive]}
                  onPress={() => { setPeriod(opt.id); setShowPeriod(false); }}>
                  <Text style={[styles.periodOptText, period===opt.id && styles.periodOptTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <RefreshCw size={16} color="#5A6573" />
        </TouchableOpacity>
      </View>

      <View style={styles.pageContent}>
        {/* Hero + cashflow row */}
        <View style={styles.topRow}>
          {/* Hero card */}
          <LinearGradient colors={['#0E1726','#1C2740']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.heroCard}>
            <View style={styles.heroOrb} />
            <Text style={styles.heroLabel}>Маржа за период</Text>
            <Text style={styles.heroValue}>{fmt(totalMargin)} Br</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Выручка</Text>
                <Text style={styles.heroStatVal}>{fmtShort(totalRevenue)} Br</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Дебиторка</Text>
                <Text style={[styles.heroStatVal, clientDebt>0 && {color:'#FFB366'}]}>{fmtShort(clientDebt)} Br</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Cashflow cards */}
          <View style={styles.cashflowCol}>
            <View style={styles.cashflowIncome}>
              <Text style={styles.cashflowLabel}>Получено от клиентов</Text>
              <Text style={styles.cashflowValGreen}>{fmt(incomeReceived)} Br</Text>
              <Text style={styles.cashflowSub}>оплаченные заявки</Text>
            </View>
            <View style={styles.cashflowPayout}>
              <Text style={styles.cashflowLabel}>Выплачено перевозчикам</Text>
              <Text style={styles.cashflowValBlue}>{fmt(expensesPaid)} Br</Text>
              <Text style={styles.cashflowSub}>к выплате: {fmt(carrierDebt)} Br</Text>
            </View>
          </View>
        </View>

        {/* KPI strip */}
        <View style={styles.kpiRow}>
          {[
            { label:'Активных заявок', val: String(activeCount), color:'#1366F0', bg:'rgba(19,102,240,0.12)' },
            { label:'Доставлено', val: String(doneCount), color:'#1E9E5A', bg:'rgba(30,158,90,0.12)' },
            { label:'Дебиторов', val: String(debtors.length), color:'#D97706', bg:'rgba(217,119,6,0.12)' },
            { label:'Всего заявок', val: String(allOrders.length), color:'#7C3AED', bg:'rgba(124,58,237,0.12)' },
          ].map((kpi, i) => (
            <View key={i} style={styles.kpiCard}>
              <View style={[styles.kpiDot, { backgroundColor: kpi.bg }]}>
                <View style={[styles.kpiDotInner, { backgroundColor: kpi.color }]} />
              </View>
              <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.val}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Two column: top clients + recent orders */}
        <View style={styles.twoCol}>
          {/* Top clients */}
          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>Топ клиентов</Text>
            <Text style={styles.cardSub}>по выручке за период</Text>
            <View style={{ marginTop: 12 }}>
              {topClients.length === 0 && <Text style={styles.empty}>Нет данных</Text>}
              {topClients.map((c, i) => {
                const idx = avatarIdx(c.name);
                const [a, b] = GRADIENTS[idx];
                return (
                  <View key={i} style={styles.clientRow}>
                    <LinearGradient colors={[a, b]} style={styles.clientAvatar}>
                      <Text style={styles.clientAvatarText}>{initials(c.name)}</Text>
                    </LinearGradient>
                    <View style={{ flex:1 }}>
                      <Text style={styles.clientName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.clientSub}>{c.cnt} заявок</Text>
                    </View>
                    <Text style={styles.clientRev}>{fmtShort(c.rev)} Br</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Debtors */}
          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>Дебиторы</Text>
            <Text style={styles.cardSub}>не оплачены доставленные</Text>
            <View style={{ marginTop: 12 }}>
              {debtors.length === 0 && <Text style={styles.empty}>Долгов нет</Text>}
              {debtors.map((d, i) => {
                const idx = avatarIdx(d.name);
                const [a, b] = GRADIENTS[idx];
                return (
                  <View key={i} style={styles.clientRow}>
                    <LinearGradient colors={[a, b]} style={styles.clientAvatar}>
                      <Text style={styles.clientAvatarText}>{initials(d.name)}</Text>
                    </LinearGradient>
                    <Text style={[styles.clientName, { flex:1 }]} numberOfLines={1}>{d.name}</Text>
                    <Text style={[styles.clientRev, { color:'#E0473B' }]}>{fmtShort(d.amt)} Br</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Recent orders */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Последние заявки</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders' as any)} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>Все заявки</Text>
              <ArrowRight size={13} color="#1366F0" />
            </TouchableOpacity>
          </View>
          {allOrders.slice(0,5).map((o: any, i: number) => {
            const sc = STATUS_COLORS[o.status] || STATUS_COLORS.new;
            const margin = Number(o.margin ?? (Number(o.client_rate)-Number(o.carrier_rate)));
            return (
              <TouchableOpacity key={o.id||i} style={styles.orderRow}
                onPress={() => router.push(`/order/${o.id}` as any)}>
                <Text style={styles.orderNum}>{o.number||o.num}</Text>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                </View>
                <Text style={styles.orderRoute} numberOfLines={1}>
                  {(o.load_address||o.loadAddress||'').split(',')[0]} → {(o.unload_address||o.unloadAddress||'').split(',')[0]}
                </Text>
                <Text style={styles.orderMargin}>{fmtShort(margin)} Br</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const GLASS = { backgroundColor: 'rgba(255,255,255,0.6)', borderWidth:1, borderColor:'rgba(255,255,255,0.7)' };

const styles = StyleSheet.create({
  scroll: { flex:1, backgroundColor:'#EDEFF3' },
  content: { flexGrow:1 },
  center: { flex:1, alignItems:'center', justifyContent:'center' },
  topbar: {
    flexDirection:'row', alignItems:'center', paddingHorizontal:24, paddingVertical:14,
    backgroundColor:'rgba(237,239,243,0.9)', borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.5)',
    gap:12,
  },
  topTitle: { fontFamily:'Onest_700Bold', fontSize:22, color:'#0E1726', letterSpacing:-0.5 },
  periodBtn: {
    paddingHorizontal:14, paddingVertical:8, borderRadius:11,
    backgroundColor:'rgba(255,255,255,0.6)', borderWidth:1, borderColor:'rgba(14,23,38,0.08)',
  },
  periodBtnText: { fontFamily:'Manrope_600SemiBold', fontSize:13, color:'#0E1726' },
  periodDropdown: {
    position:'absolute' as any, top:40, right:0, width:180, zIndex:999,
    backgroundColor:'rgba(255,255,255,0.95)', borderRadius:16,
    borderWidth:1, borderColor:'rgba(255,255,255,0.8)',
    shadowColor:'#0E1726', shadowOffset:{width:0,height:8}, shadowOpacity:0.15, shadowRadius:20, elevation:10,
    padding:6,
  },
  periodOpt: { paddingVertical:9, paddingHorizontal:13, borderRadius:10 },
  periodOptActive: { backgroundColor:'#0E1726' },
  periodOptText: { fontFamily:'Manrope_500Medium', fontSize:13, color:'#0E1726' },
  periodOptTextActive: { color:'#fff', fontFamily:'Manrope_600SemiBold' },
  refreshBtn: {
    width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.6)',
    borderWidth:1, borderColor:'rgba(14,23,38,0.08)', alignItems:'center', justifyContent:'center',
  },
  pageContent: { padding:24, gap:16 },
  topRow: { flexDirection:'row', gap:16 },
  heroCard: {
    flex:1.4, borderRadius:24, padding:24,
    overflow:'hidden', position:'relative' as any,
  },
  heroOrb: {
    position:'absolute' as any, width:200, height:200, top:-60, right:-40, borderRadius:100,
    backgroundColor:'rgba(19,102,240,0.18)',
  },
  heroLabel: { fontFamily:'Manrope_500Medium', fontSize:12.5, color:'rgba(255,255,255,0.6)', marginBottom:6 },
  heroValue: { fontFamily:'Onest_800ExtraBold', fontSize:32, color:'#fff', letterSpacing:-1, marginBottom:16 },
  heroRow: { flexDirection:'row', gap:24, marginTop:8, paddingTop:14, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.12)' },
  heroStat: {},
  heroStatLabel: { fontFamily:'Manrope_400Regular', fontSize:11, color:'rgba(255,255,255,0.5)' },
  heroStatVal: { fontFamily:'Onest_700Bold', fontSize:17, color:'#fff', marginTop:3 },
  cashflowCol: { flex:1, gap:16 },
  cashflowIncome: {
    flex:1, borderRadius:22, padding:20,
    backgroundColor:'rgba(30,158,90,0.1)', borderWidth:1, borderColor:'rgba(30,158,90,0.2)',
  },
  cashflowPayout: {
    flex:1, borderRadius:22, padding:20,
    backgroundColor:'rgba(54,131,196,0.1)', borderWidth:1, borderColor:'rgba(54,131,196,0.2)',
  },
  cashflowLabel: { fontFamily:'Manrope_500Medium', fontSize:12, color:'#5A6573', marginBottom:6 },
  cashflowValGreen: { fontFamily:'Onest_700Bold', fontSize:22, color:'#1E9E5A', letterSpacing:-0.5 },
  cashflowValBlue: { fontFamily:'Onest_700Bold', fontSize:22, color:'#3683C4', letterSpacing:-0.5 },
  cashflowSub: { fontFamily:'Manrope_400Regular', fontSize:11.5, color:'#8A93A0', marginTop:4 },
  kpiRow: { flexDirection:'row', gap:16 },
  kpiCard: {
    flex:1, borderRadius:20, padding:18,
    ...GLASS,
    shadowColor:'#0E1726', shadowOffset:{width:0,height:8}, shadowOpacity:0.1, shadowRadius:20,
  },
  kpiDot: { width:32, height:32, borderRadius:10, alignItems:'center', justifyContent:'center', marginBottom:10 },
  kpiDotInner: { width:10, height:10, borderRadius:5 },
  kpiValue: { fontFamily:'Onest_800ExtraBold', fontSize:26, letterSpacing:-0.5, marginBottom:4 },
  kpiLabel: { fontFamily:'Manrope_500Medium', fontSize:12, color:'#8A93A0' },
  twoCol: { flexDirection:'row', gap:16 },
  glassCard: {
    flex:1, borderRadius:22, padding:22,
    ...GLASS,
    shadowColor:'#0E1726', shadowOffset:{width:0,height:10}, shadowOpacity:0.1, shadowRadius:28,
  },
  cardHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:2 },
  cardTitle: { fontFamily:'Onest_700Bold', fontSize:16, color:'#0E1726' },
  cardSub: { fontFamily:'Manrope_400Regular', fontSize:12, color:'#8A93A0', marginTop:2 },
  seeAllBtn: { flexDirection:'row', alignItems:'center', gap:4 },
  seeAllText: { fontFamily:'Manrope_600SemiBold', fontSize:13, color:'#1366F0' },
  clientRow: { flexDirection:'row', alignItems:'center', gap:11, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(14,23,38,0.05)' },
  clientAvatar: { width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center', flexShrink:0 },
  clientAvatarText: { color:'#fff', fontFamily:'Onest_700Bold', fontSize:12 },
  clientName: { fontFamily:'Manrope_600SemiBold', fontSize:13.5, color:'#0E1726' },
  clientSub: { fontFamily:'Manrope_400Regular', fontSize:11.5, color:'#8A93A0', marginTop:2 },
  clientRev: { fontFamily:'Onest_700Bold', fontSize:13.5, color:'#1366F0', flexShrink:0 },
  empty: { fontFamily:'Manrope_400Regular', fontSize:13, color:'#A6AEB8', textAlign:'center', paddingVertical:16 },
  orderRow: { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, borderBottomWidth:1, borderBottomColor:'rgba(14,23,38,0.05)' },
  orderNum: { fontFamily:'Onest_700Bold', fontSize:12.5, color:'#0E1726', flexShrink:0 },
  badge: { paddingHorizontal:9, paddingVertical:4, borderRadius:8, flexShrink:0 },
  badgeText: { fontFamily:'Manrope_700Bold', fontSize:11, fontWeight:'700' },
  orderRoute: { flex:1, fontFamily:'Manrope_400Regular', fontSize:13, color:'#5A6573' },
  orderMargin: { fontFamily:'Onest_700Bold', fontSize:13, color:'#1E9E5A', flexShrink:0 },
});
