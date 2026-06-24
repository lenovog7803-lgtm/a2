import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Plus, ChevronRight } from 'lucide-react-native';
import { api } from '../../src/api';

const STATUS_META: Record<string, { color:string; bg:string; label:string }> = {
  new:         { color:'#1366F0', bg:'rgba(19,102,240,0.12)',  label:'Новая' },
  in_progress: { color:'#D97706', bg:'rgba(217,119,6,0.14)',   label:'В работе' },
  delivered:   { color:'#1E9E5A', bg:'rgba(30,158,90,0.14)',   label:'Доставлено' },
  cancelled:   { color:'#E0473B', bg:'rgba(224,71,59,0.12)',   label:'Отменено' },
};
const GRADIENTS = [
  ['#FFD8A8','#FF922B'], ['#D0BFFF','#7C3AED'], ['#A5D8FF','#1366F0'],
  ['#B2F2BB','#1E9E5A'], ['#FFC9C9','#E0473B'], ['#99E9F2','#0CA6C0'],
];
const avatarIdx = (n: string) => n.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % GRADIENTS.length;
const initials = (name: string) => {
  const clean = (name||'').replace(/^(ООО|АО|ОАО|ЗАО|ТД|ИП|ПАО)\s+/i,'').trim();
  const w = clean.split(/[\s-]+/).filter(Boolean);
  return ((w[0]?.[0]||'')+(w[1]?.[0]||w[0]?.[1]||'')).toUpperCase();
};
const fmt = (n: number) => Math.round(n||0).toLocaleString('ru-RU');
const fmtDate = (s: string) => { if(!s) return '—'; const p=s.split('-'); return p[2]+'.'+p[1]; };
const FILTERS = [
  { k:'all', label:'Все' }, { k:'new', label:'Новые' },
  { k:'in_progress', label:'В работе' }, { k:'delivered', label:'Доставлено' },
  { k:'cancelled', label:'Отменено' },
];

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders(await api.orders.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const filtered = orders
    .filter(o => filter==='all' || o.status===filter)
    .filter(o => !q || (
      (o.number||o.num||'').toLowerCase().includes(q) ||
      (o.client_name||o.clientName||'').toLowerCase().includes(q) ||
      (o.carrier_name||o.carrierName||'').toLowerCase().includes(q) ||
      (o.load_address||o.loadAddress||'').toLowerCase().includes(q)
    ));

  const counts: Record<string,number> = { all: orders.length };
  FILTERS.slice(1).forEach(f => { counts[f.k] = orders.filter(o=>o.status===f.k).length; });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Заявки</Text>
        <View style={{ flex:1 }} />
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/order/new' as any)}>
          <Plus size={16} color="#fff" strokeWidth={2.2} />
          <Text style={styles.addBtnText}>Новая заявка</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.page}>
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.k} style={[styles.chip, filter===f.k && styles.chipActive]}
              onPress={() => setFilter(f.k)} activeOpacity={0.7}>
              <Text style={[styles.chipText, filter===f.k && styles.chipTextActive]}>
                {f.label}  {counts[f.k]??0}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={16} color="#8A93A0" strokeWidth={1.9} />
          <TextInput
            style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Поиск по заявкам…" placeholderTextColor="#A6AEB8"
          />
        </View>

        {/* Table */}
        {loading ? (
          <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>
        ) : (
          <View style={styles.tableWrap}>
            <View style={styles.tableHeader}>
              <Text style={[styles.col, { flex:2 }]}>ЗАЯВКА</Text>
              <Text style={[styles.col, { flex:1.8 }]}>МАРШРУТ</Text>
              <Text style={[styles.col, { flex:1.4 }]}>КЛИЕНТ</Text>
              <Text style={[styles.col, { flex:1, textAlign:'right' }]}>МАРЖА</Text>
              <Text style={[styles.col, { flex:0.9, textAlign:'center' }]}>К/П</Text>
            </View>

            {filtered.length===0 && <Text style={styles.empty}>Заявок нет</Text>}

            {filtered.map((o, i) => {
              const sc = STATUS_META[o.status] || STATUS_META.new;
              const margin = Number(o.margin ?? (Number(o.client_rate)-Number(o.carrier_rate)));
              const marginPct = Number(o.client_rate) ? (margin/Number(o.client_rate)*100).toFixed(0) : '0';
              const clientName = o.client_name||o.clientName||'';
              const [a,b] = GRADIENTS[avatarIdx(clientName)];
              const clientPaid = o.client_paid ?? o.clientPaid ?? false;
              const carrierPaid = o.carrier_paid ?? o.carrierPaid ?? false;
              const from = (o.load_address||o.loadAddress||'').split(',')[0] || o.route_from || o.routeFrom || '';
              const to = (o.unload_address||o.unloadAddress||'').split(',')[0] || o.route_to || o.routeTo || '';
              return (
                <TouchableOpacity key={o.id||i} style={[styles.row, i===filtered.length-1&&{borderBottomWidth:0}]}
                  onPress={() => router.push(`/order/${o.id}` as any)} activeOpacity={0.7}>
                  <View style={{ flex:2, gap:5 }}>
                    <Text style={styles.orderNum}>{o.number||o.num}</Text>
                    <View style={[styles.badge, { backgroundColor:sc.bg }]}>
                      <Text style={[styles.badgeText, { color:sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                  <View style={{ flex:1.8, gap:3 }}>
                    <Text style={styles.routeText} numberOfLines={1}>{from} → {to}</Text>
                    <Text style={styles.dateText}>{fmtDate(o.load_date||o.loadDate)} – {fmtDate(o.unload_date||o.unloadDate)}</Text>
                  </View>
                  <View style={{ flex:1.4, flexDirection:'row', alignItems:'center', gap:7 }}>
                    <LinearGradient colors={[a,b]} style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(clientName)}</Text>
                    </LinearGradient>
                    <Text style={styles.clientName} numberOfLines={2}>{clientName}</Text>
                  </View>
                  <View style={{ flex:1, alignItems:'flex-end' }}>
                    <Text style={styles.marginVal}>{fmt(margin)} Br</Text>
                    <Text style={styles.marginPct}>{marginPct}%</Text>
                  </View>
                  <View style={{ flex:0.9, flexDirection:'row', gap:4, justifyContent:'center' }}>
                    <View style={[styles.pill, clientPaid?styles.pillGreen:styles.pillOrange]}>
                      <Text style={[styles.pillText,{color:clientPaid?'#1E9E5A':'#D97706'}]}>К</Text>
                    </View>
                    <View style={[styles.pill, carrierPaid?styles.pillGreen:styles.pillPurple]}>
                      <Text style={[styles.pillText,{color:carrierPaid?'#1E9E5A':'#7C3AED'}]}>П</Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#A6AEB8" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex:1, backgroundColor:'#EDEFF3' },
  content: {},
  topbar: {
    flexDirection:'row', alignItems:'center', paddingHorizontal:24, paddingVertical:14,
    backgroundColor:'rgba(237,239,243,0.9)', borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.5)', gap:12,
  },
  topTitle: { fontFamily:'Onest_700Bold', fontSize:22, color:'#0E1726', letterSpacing:-0.5 },
  addBtn: {
    flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:18, paddingVertical:11,
    borderRadius:13, backgroundColor:'#0E1726',
    shadowColor:'#0E1726', shadowOffset:{width:0,height:8}, shadowOpacity:0.5, shadowRadius:16,
  },
  addBtnText: { fontFamily:'Manrope_600SemiBold', fontSize:13.5, color:'#fff' },
  page: { padding:24, gap:16 },
  chips: { flexDirection:'row', gap:9 },
  chip: {
    paddingHorizontal:15, paddingVertical:8, borderRadius:11,
    backgroundColor:'rgba(255,255,255,0.5)', borderWidth:1, borderColor:'rgba(14,23,38,0.08)',
  },
  chipActive: { backgroundColor:'#0E1726', borderColor:'transparent' },
  chipText: { fontFamily:'Manrope_600SemiBold', fontSize:13, color:'#5A6573' },
  chipTextActive: { color:'#fff' },
  searchBox: {
    flexDirection:'row', alignItems:'center', gap:9, paddingHorizontal:14, paddingVertical:10,
    borderRadius:13, backgroundColor:'rgba(255,255,255,0.6)', borderWidth:1, borderColor:'rgba(14,23,38,0.08)',
  },
  searchInput: { flex:1, fontFamily:'Manrope_400Regular', fontSize:13.5, color:'#0E1726' },
  loaderWrap: { paddingVertical:40, alignItems:'center' },
  tableWrap: {
    borderRadius:22, overflow:'hidden', backgroundColor:'rgba(255,255,255,0.58)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.72)',
    shadowColor:'#0E1726', shadowOffset:{width:0,height:12}, shadowOpacity:0.1, shadowRadius:28,
  },
  tableHeader: {
    flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:12,
    backgroundColor:'rgba(14,23,38,0.03)', borderBottomWidth:1, borderBottomColor:'rgba(14,23,38,0.06)', gap:12,
  },
  col: { fontFamily:'Manrope_600SemiBold', fontSize:10.5, letterSpacing:0.6, color:'#A6AEB8' },
  row: {
    flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:16,
    borderBottomWidth:1, borderBottomColor:'rgba(14,23,38,0.05)', gap:12,
  },
  orderNum: { fontFamily:'Onest_700Bold', fontSize:13, color:'#0E1726' },
  badge: { paddingHorizontal:9, paddingVertical:4, borderRadius:8, alignSelf:'flex-start' },
  badgeText: { fontFamily:'Manrope_700Bold', fontSize:11, fontWeight:'700' },
  routeText: { fontFamily:'Manrope_500Medium', fontSize:13, color:'#0E1726' },
  dateText: { fontFamily:'Manrope_400Regular', fontSize:11.5, color:'#A6AEB8' },
  avatar: { width:34, height:34, borderRadius:10, alignItems:'center', justifyContent:'center', flexShrink:0 },
  avatarText: { color:'#fff', fontFamily:'Onest_700Bold', fontSize:11 },
  clientName: { fontFamily:'Manrope_600SemiBold', fontSize:12.5, color:'#0E1726', flex:1 },
  marginVal: { fontFamily:'Onest_700Bold', fontSize:13.5, color:'#1E9E5A' },
  marginPct: { fontFamily:'Manrope_500Medium', fontSize:11, color:'#8A93A0' },
  pill: { width:26, height:20, borderRadius:7, alignItems:'center', justifyContent:'center' },
  pillGreen: { backgroundColor:'rgba(30,158,90,0.13)' },
  pillOrange: { backgroundColor:'rgba(217,119,6,0.13)' },
  pillPurple: { backgroundColor:'rgba(124,58,237,0.13)' },
  pillText: { fontFamily:'Manrope_700Bold', fontSize:11, fontWeight:'700' },
  empty: { fontFamily:'Manrope_400Regular', fontSize:13.5, color:'#A6AEB8', textAlign:'center', padding:40 },
});
