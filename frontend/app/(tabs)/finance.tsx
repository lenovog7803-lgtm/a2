import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react-native';
import { api } from '../../src/api';

const fmt = (n: number) => Math.round(n||0).toLocaleString('ru-RU');
const fmtDate = (s: string) => { if(!s) return '—'; const p = s.split('-'); return `${p[2]}.${p[1]}.${p[0]}`; };

const GRADIENTS = [
  ['#FFD8A8','#FF922B'],['#D0BFFF','#7C3AED'],['#A5D8FF','#1366F0'],
  ['#B2F2BB','#1E9E5A'],['#FFC9C9','#E0473B'],['#99E9F2','#0CA6C0'],
];
const avatarIdx=(n:string)=>n.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%GRADIENTS.length;
const initials=(name:string)=>{
  const clean=(name||'').replace(/^(ООО|АО|ОАО|ЗАО|ТД|ИП|ПАО)\s+/i,'').trim();
  const w=clean.split(/[\s-]+/).filter(Boolean);
  return ((w[0]?.[0]||'')+(w[1]?.[0]||w[0]?.[1]||'')).toUpperCase();
};

const TABS = ['Движение средств','Поступления','Выплаты','Акт сверки'];

export default function Finance() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [paymentsIn, setPaymentsIn] = useState<any[]>([]);
  const [paymentsOut, setPaymentsOut] = useState<any[]>([]);
  const [tab, setTab] = useState(0);
  const [showInModal, setShowInModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [recClientId, setRecClientId] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ords, pIn, pOut, cList] = await Promise.all([
        api.orders.list().catch(()=>[]),
        api.paymentsIn.list().catch(()=>[]),
        api.paymentsOut.list().catch(()=>[]),
        api.clients.list().catch(()=>[]),
      ]);
      setOrders(ords); setPaymentsIn(pIn); setPaymentsOut(pOut); setClients(cList);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleGenerateAct = async () => {
    if (!recClientId) { Alert.alert('Выберите клиента'); return; }
    setGenerating(true);
    try {
      const result = await api.clients.generateActs(recClientId);
      if (result?.url) {
        await Linking.openURL(result.url);
        Alert.alert('Готово', `${result.created ?? ''} актов объединены в один документ.`);
      } else {
        Alert.alert('Готово', 'Документ создан');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать акт');
    } finally {
      setGenerating(false);
    }
  };

  const nonCancelled = orders.filter((o:any)=>o.status!=='cancelled');
  const sum=(arr:any[],f:(o:any)=>number)=>arr.reduce((a,o)=>a+f(o),0);
  const totalMargin = sum(nonCancelled, o=>Number(o.client_rate||0)-Number(o.carrier_rate||0));
  const incomeReceived = sum(orders.filter((o:any)=>o.client_paid), o=>Number(o.client_rate||0));
  const expensesPaid = sum(orders.filter((o:any)=>o.carrier_paid), o=>Number(o.carrier_rate||0));
  const clientDebt = sum(orders.filter((o:any)=>o.status==='delivered'&&!o.client_paid), o=>Number(o.client_rate||0));
  const carrierDebt = sum(orders.filter((o:any)=>o.status!=='cancelled'&&!o.carrier_paid), o=>Number(o.carrier_rate||0));

  // Ledger — combine all paid events
  const ledger: any[] = [
    ...orders.filter((o:any)=>o.client_paid).map(o=>({
      id:'ci_'+o.id, title:o.client_name||o.clientName||'Клиент', sub:`Заявка ${o.number||o.num} · оплата от клиента`,
      date: o.load_date||o.loadDate||'', amt:Number(o.client_rate||0), sign:1, name:o.client_name||o.clientName||'',
    })),
    ...orders.filter((o:any)=>o.carrier_paid).map(o=>({
      id:'co_'+o.id, title:o.carrier_name||o.carrierName||'Перевозчик', sub:`Заявка ${o.number||o.num} · выплата перевозчику`,
      date: o.load_date||o.loadDate||'', amt:Number(o.carrier_rate||0), sign:-1, name:o.carrier_name||o.carrierName||'',
    })),
    ...paymentsIn.map(p=>({ id:'pi_'+p.id, title:p.client_name||'Клиент', sub:`Поступление · ${p.notes||''}`, date:p.date||'', amt:Number(p.amount||0), sign:1, name:p.client_name||'' })),
    ...paymentsOut.map(p=>({ id:'po_'+p.id, title:p.carrier_name||'Перевозчик', sub:`Выплата · ${p.notes||''}`, date:p.date||'', amt:Number(p.amount||0), sign:-1, name:p.carrier_name||'' })),
  ].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Финансы</Text>
        <View style={{flex:1}} />
        {tab===1 && <TouchableOpacity style={styles.addBtn} onPress={()=>setShowInModal(true)}><Plus size={16} color="#fff" /><Text style={styles.addBtnText}>Поступление</Text></TouchableOpacity>}
        {tab===2 && <TouchableOpacity style={styles.addBtn} onPress={()=>setShowOutModal(true)}><Plus size={16} color="#fff" /><Text style={styles.addBtnText}>Выплата</Text></TouchableOpacity>}
      </View>

      <View style={styles.page}>
        {/* Summary band */}
        <View style={styles.summaryRow}>
          <LinearGradient colors={['#0E1726','#1C2740']} style={styles.heroCard}>
            <View style={styles.heroOrb} />
            <Text style={styles.heroLabel}>Маржа общая</Text>
            <Text style={styles.heroValue}>{fmt(totalMargin)} Br</Text>
          </LinearGradient>
          <View style={styles.cashflowIncome}>
            <TrendingUp size={18} color="#1E9E5A" />
            <Text style={styles.cashLabel}>Получено</Text>
            <Text style={styles.cashValGreen}>{fmt(incomeReceived)} Br</Text>
            <Text style={styles.cashSub}>к получению: {fmt(clientDebt)} Br</Text>
          </View>
          <View style={styles.cashflowPayout}>
            <TrendingDown size={18} color="#3683C4" />
            <Text style={styles.cashLabel}>Выплачено</Text>
            <Text style={styles.cashValBlue}>{fmt(expensesPaid)} Br</Text>
            <Text style={styles.cashSub}>к выплате: {fmt(carrierDebt)} Br</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map((t,i)=>(
            <TouchableOpacity key={i} style={[styles.tabBtn, tab===i&&styles.tabBtnActive]} onPress={()=>setTab(i)}>
              <Text style={[styles.tabText, tab===i&&styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>
        ) : tab===0 ? (
          <LedgerList ledger={ledger} />
        ) : tab===1 ? (
          <PaymentsList items={paymentsIn} sign={1} onDelete={async(id)=>{try{await api.paymentsIn.remove(id);load();}catch{}}} />
        ) : tab===2 ? (
          <PaymentsList items={paymentsOut} sign={-1} onDelete={async(id)=>{try{await api.paymentsOut.remove(id);load();}catch{}}} />
        ) : (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Акт сверки</Text>
            <Text style={styles.sectionSub}>Объединяет все акты клиента в один Google Документ</Text>
            <Text style={[styles.formLabel,{marginTop:16,marginBottom:8}]}>КЛИЕНТ</Text>
            <View style={styles.pickerWrap}>
              {clients.map(c=>(
                <TouchableOpacity key={c.id} onPress={()=>setRecClientId(c.id)}
                  style={[styles.pickerItem, recClientId===c.id && styles.pickerItemActive]}>
                  <Text style={[styles.pickerItemText, recClientId===c.id && styles.pickerItemTextActive]} numberOfLines={1}>{c.name}</Text>
                </TouchableOpacity>
              ))}
              {clients.length===0 && <Text style={styles.empty}>Нет клиентов</Text>}
            </View>
            <TouchableOpacity onPress={handleGenerateAct} disabled={generating || !recClientId}
              style={[styles.saveBtn,{marginTop:20,opacity:recClientId&&!generating?1:0.5}]}>
              {generating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveText}>Сформировать акт сверки</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showInModal && <PaymentModal title="Поступление" onClose={()=>setShowInModal(false)} onSaved={()=>{setShowInModal(false);load();}} apiCreate={api.paymentsIn.create} />}
      {showOutModal && <PaymentModal title="Выплата" onClose={()=>setShowOutModal(false)} onSaved={()=>{setShowOutModal(false);load();}} apiCreate={api.paymentsOut.create} />}
    </ScrollView>
  );
}

function LedgerList({ ledger }: { ledger: any[] }) {
  if (ledger.length===0) return <Text style={styles.empty}>Движений нет</Text>;
  return (
    <View style={styles.glassCard}>
      <Text style={styles.sectionTitle}>Движение средств</Text>
      <Text style={styles.sectionSub}>последние операции</Text>
      {ledger.slice(0,20).map((t,i)=>{
        const idx = avatarIdx(t.name||'');
        const [a,b] = GRADIENTS[idx];
        return (
          <View key={t.id||i} style={[styles.ledgerRow, i===Math.min(19,ledger.length-1)&&{borderBottomWidth:0}]}>
            <LinearGradient colors={[a,b]} style={styles.ledgerAvatar}>
              <Text style={styles.ledgerAvatarText}>{initials(t.name||t.title||'')}</Text>
            </LinearGradient>
            <View style={{flex:1,minWidth:0}}>
              <Text style={styles.ledgerTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={styles.ledgerSub} numberOfLines={1}>{t.sub}</Text>
            </View>
            <Text style={styles.ledgerDate}>{fmtDate(t.date)}</Text>
            <Text style={[styles.ledgerAmt, {color: t.sign>0?'#1E9E5A':'#3683C4'}]}>
              {t.sign>0?'+':'-'}{fmt(t.amt)} Br
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PaymentsList({ items, sign, onDelete }: { items:any[]; sign:number; onDelete:(id:string)=>void }) {
  if (items.length===0) return <Text style={styles.empty}>{sign>0?'Поступлений нет':'Выплат нет'}</Text>;
  return (
    <View style={styles.glassCard}>
      {items.map((p,i)=>(
        <View key={p.id||i} style={[styles.ledgerRow, i===items.length-1&&{borderBottomWidth:0}]}>
          <View style={{flex:1}}>
            <Text style={styles.ledgerTitle}>{p.client_name||p.carrier_name||'—'}</Text>
            {p.notes && <Text style={styles.ledgerSub}>{p.notes}</Text>}
          </View>
          <Text style={styles.ledgerDate}>{fmtDate(p.date||p.created_at||'')}</Text>
          <Text style={[styles.ledgerAmt, {color:sign>0?'#1E9E5A':'#3683C4'}]}>{sign>0?'+':'-'}{fmt(Number(p.amount||0))} Br</Text>
          <TouchableOpacity onPress={()=>onDelete(p.id)} style={styles.delBtn}>
            <X size={13} color="#E0473B" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function PaymentModal({ title, onClose, onSaved, apiCreate }: { title:string; onClose:()=>void; onSaved:()=>void; apiCreate:(d:any)=>Promise<any> }) {
  const [form, setForm] = useState({ amount:'', date:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.amount) { Alert.alert('Ошибка','Введите сумму'); return; }
    setSaving(true);
    try { await apiCreate({ ...form, amount: Number(form.amount) }); onSaved(); }
    catch(e:any) { Alert.alert('Ошибка', e.message||'Ошибка'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#5A6573" /></TouchableOpacity>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>СУММА, Br *</Text>
            <TextInput style={styles.formInput} value={form.amount} onChangeText={v=>set('amount',v)} placeholder="50000" placeholderTextColor="#A6AEB8" keyboardType="numeric" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>ДАТА</Text>
            <TextInput style={styles.formInput} value={form.date} onChangeText={v=>set('date',v)} placeholder="2026-02-15" placeholderTextColor="#A6AEB8" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>ОСНОВАНИЕ / ЗАМЕТКИ</Text>
            <TextInput style={styles.formInput} value={form.notes} onChangeText={v=>set('notes',v)} placeholder="" placeholderTextColor="#A6AEB8" multiline />
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Отмена</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}><Text style={styles.saveText}>{saving?'Сохранение…':'Добавить'}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll:{flex:1,backgroundColor:'#EDEFF3'}, content:{},
  topbar:{flexDirection:'row',alignItems:'center',paddingHorizontal:24,paddingVertical:14,backgroundColor:'rgba(237,239,243,0.9)',borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.5)',gap:12},
  topTitle:{fontFamily:'Onest_700Bold',fontSize:22,color:'#0E1726',letterSpacing:-0.5},
  addBtn:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:18,paddingVertical:11,borderRadius:13,backgroundColor:'#0E1726',shadowColor:'#0E1726',shadowOffset:{width:0,height:8},shadowOpacity:0.5,shadowRadius:16},
  addBtnText:{fontFamily:'Manrope_600SemiBold',fontSize:13.5,color:'#fff'},
  page:{padding:24,gap:16},
  summaryRow:{flexDirection:'row',gap:16},
  heroCard:{flex:1.5,borderRadius:22,padding:22,overflow:'hidden',position:'relative' as any},
  heroOrb:{position:'absolute' as any,width:150,height:150,top:-40,right:-30,borderRadius:75,backgroundColor:'rgba(19,102,240,0.18)'},
  heroLabel:{fontFamily:'Manrope_500Medium',fontSize:12,color:'rgba(255,255,255,0.6)',marginBottom:6},
  heroValue:{fontFamily:'Onest_800ExtraBold',fontSize:26,color:'#fff',letterSpacing:-0.8},
  cashflowIncome:{flex:1,borderRadius:22,padding:20,backgroundColor:'rgba(30,158,90,0.1)',borderWidth:1,borderColor:'rgba(30,158,90,0.2)',gap:6},
  cashflowPayout:{flex:1,borderRadius:22,padding:20,backgroundColor:'rgba(54,131,196,0.1)',borderWidth:1,borderColor:'rgba(54,131,196,0.2)',gap:6},
  cashLabel:{fontFamily:'Manrope_500Medium',fontSize:12,color:'#5A6573'},
  cashValGreen:{fontFamily:'Onest_700Bold',fontSize:20,color:'#1E9E5A',letterSpacing:-0.5},
  cashValBlue:{fontFamily:'Onest_700Bold',fontSize:20,color:'#3683C4',letterSpacing:-0.5},
  cashSub:{fontFamily:'Manrope_400Regular',fontSize:11.5,color:'#8A93A0'},
  tabRow:{flexDirection:'row',gap:9,borderRadius:14,backgroundColor:'rgba(255,255,255,0.4)',padding:4,borderWidth:1,borderColor:'rgba(255,255,255,0.5)'},
  tabBtn:{flex:1,paddingVertical:9,borderRadius:11,alignItems:'center'},
  tabBtnActive:{backgroundColor:'#0E1726'},
  tabText:{fontFamily:'Manrope_600SemiBold',fontSize:13,color:'#5A6573'},
  tabTextActive:{color:'#fff'},
  loaderWrap:{paddingVertical:40,alignItems:'center'},
  glassCard:{borderRadius:22,overflow:'hidden',backgroundColor:'rgba(255,255,255,0.6)',borderWidth:1,borderColor:'rgba(255,255,255,0.72)',padding:22,shadowColor:'#0E1726',shadowOffset:{width:0,height:10},shadowOpacity:0.1,shadowRadius:28},
  sectionTitle:{fontFamily:'Onest_700Bold',fontSize:16,color:'#0E1726'},
  sectionSub:{fontFamily:'Manrope_400Regular',fontSize:12,color:'#8A93A0',marginTop:2,marginBottom:8},
  ledgerRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,borderBottomWidth:1,borderBottomColor:'rgba(14,23,38,0.06)'},
  ledgerAvatar:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',flexShrink:0},
  ledgerAvatarText:{color:'#fff',fontFamily:'Onest_700Bold',fontSize:12},
  ledgerTitle:{fontFamily:'Manrope_600SemiBold',fontSize:13.5,color:'#0E1726'},
  ledgerSub:{fontFamily:'Manrope_400Regular',fontSize:11.5,color:'#8A93A0',marginTop:2},
  ledgerDate:{fontFamily:'Onest_700Bold',fontSize:12,color:'#A6AEB8',flexShrink:0},
  ledgerAmt:{fontFamily:'Onest_700Bold',fontSize:14,flexShrink:0,minWidth:110,textAlign:'right'},
  delBtn:{width:30,height:30,borderRadius:8,backgroundColor:'rgba(224,71,59,0.08)',alignItems:'center',justifyContent:'center',flexShrink:0},
  empty:{fontFamily:'Manrope_400Regular',fontSize:13.5,color:'#A6AEB8',textAlign:'center',padding:40},
  pickerWrap:{gap:8},
  pickerItem:{paddingHorizontal:14,paddingVertical:11,borderRadius:12,borderWidth:1,borderColor:'rgba(14,23,38,0.12)',backgroundColor:'rgba(255,255,255,0.6)'},
  pickerItemActive:{borderColor:'#1366F0',backgroundColor:'rgba(19,102,240,0.08)'},
  pickerItemText:{fontFamily:'Manrope_500Medium',fontSize:13.5,color:'#5A6573'},
  pickerItemTextActive:{color:'#1366F0',fontWeight:'700' as any},
  overlay:{flex:1,backgroundColor:'rgba(20,28,46,0.34)',alignItems:'center',justifyContent:'center',padding:28},
  modal:{width:'100%',maxWidth:480,backgroundColor:'rgba(255,255,255,0.96)',borderRadius:26,borderWidth:1,borderColor:'rgba(255,255,255,0.9)',shadowColor:'#0E1726',shadowOffset:{width:0,height:40},shadowOpacity:0.4,shadowRadius:60,padding:24},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:20,paddingBottom:16,borderBottomWidth:1,borderBottomColor:'rgba(14,23,38,0.07)'},
  modalTitle:{fontFamily:'Onest_700Bold',fontSize:18,color:'#0E1726'},
  closeBtn:{width:36,height:36,borderRadius:11,backgroundColor:'rgba(14,23,38,0.04)',alignItems:'center',justifyContent:'center'},
  formGroup:{marginBottom:14},
  formLabel:{fontFamily:'Manrope_600SemiBold',fontSize:11.5,letterSpacing:0.6,color:'#8A93A0',marginBottom:7},
  formInput:{paddingHorizontal:13,paddingVertical:11,borderRadius:12,borderWidth:1,borderColor:'rgba(14,23,38,0.12)',backgroundColor:'rgba(255,255,255,0.75)',fontFamily:'Manrope_400Regular',fontSize:14,color:'#0E1726'},
  formActions:{flexDirection:'row',gap:12,marginTop:6,paddingTop:18,borderTopWidth:1,borderTopColor:'rgba(14,23,38,0.07)'},
  cancelBtn:{flex:1,paddingVertical:13,borderRadius:13,borderWidth:1,borderColor:'rgba(14,23,38,0.12)',backgroundColor:'rgba(255,255,255,0.6)',alignItems:'center'},
  cancelText:{fontFamily:'Manrope_600SemiBold',fontSize:14,color:'#5A6573'},
  saveBtn:{flex:2,paddingVertical:13,borderRadius:13,backgroundColor:'#1E9E5A',alignItems:'center'},
  saveText:{fontFamily:'Manrope_600SemiBold',fontSize:14,color:'#fff'},
});
