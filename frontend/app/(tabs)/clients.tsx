import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, Plus, X, Phone, Mail } from 'lucide-react-native';
import { api } from '../../src/api';

const GRADIENTS = [
  ['#FFD8A8','#FF922B'],['#D0BFFF','#7C3AED'],['#A5D8FF','#1366F0'],
  ['#B2F2BB','#1E9E5A'],['#FFC9C9','#E0473B'],['#99E9F2','#0CA6C0'],
];
const avatarIdx = (n: string) => n.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%GRADIENTS.length;
const initials = (name: string) => {
  const clean=(name||'').replace(/^(ООО|АО|ОАО|ЗАО|ТД|ИП|ПАО)\s+/i,'').trim();
  const w=clean.split(/[\s-]+/).filter(Boolean);
  return ((w[0]?.[0]||'')+(w[1]?.[0]||w[0]?.[1]||'')).toUpperCase();
};
const fmtShort=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?Math.round(n/1e3)+'K':n>0?String(Math.round(n)):'—';

export default function Clients() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setClients(await api.clients.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c=>[c.name,c.contact_person,c.phone,c.city].some(f=>(f||'').toLowerCase().includes(q)))
    : clients;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Клиенты</Text>
        <View style={{flex:1}} />
        <TouchableOpacity style={styles.addBtn} onPress={()=>setShowModal(true)}>
          <Plus size={16} color="#fff" strokeWidth={2.2} />
          <Text style={styles.addBtnText}>Добавить клиента</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.page}>
        <View style={styles.searchBox}>
          <Search size={16} color="#8A93A0" strokeWidth={1.9} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Поиск по клиентам…" placeholderTextColor="#A6AEB8" />
        </View>

        <Text style={styles.count}>Всего клиентов: <Text style={styles.countNum}>{filtered.length}</Text></Text>

        {loading ? (
          <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>
        ) : (
          <View style={styles.grid}>
            {filtered.length===0 && <Text style={styles.empty}>Клиентов нет</Text>}
            {filtered.map((c,i) => {
              const [a,b] = GRADIENTS[avatarIdx(c.name||'')];
              const rev = Number(c.total_revenue||0);
              return (
                <TouchableOpacity key={c.id||i} style={styles.card}
                  onPress={()=>router.push(`/client/${c.id}` as any)} activeOpacity={0.8}>
                  <View style={styles.cardTop}>
                    <LinearGradient colors={[a,b]} style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(c.name||'')}</Text>
                    </LinearGradient>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {[c.contact_person,c.city].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stats}>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Выручка</Text>
                      <Text style={styles.statVal}>{fmtShort(rev)} Br</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Заявок</Text>
                      <Text style={styles.statVal}>{c.orders_count||0}</Text>
                    </View>
                  </View>
                  {(c.inn||c.city) && (
                    <Text style={styles.meta} numberOfLines={1}>
                      {[c.inn&&`УНП ${c.inn}`,c.payment_terms].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  <View style={styles.cardActions}>
                    {c.phone && (
                      <TouchableOpacity style={styles.actionBtn} onPress={()=>{}}>
                        <Phone size={15} color="#1366F0" />
                      </TouchableOpacity>
                    )}
                    {c.email && (
                      <TouchableOpacity style={styles.actionBtnGhost} onPress={()=>{}}>
                        <Mail size={15} color="#5A6573" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {showModal && <ClientModal onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load();}} />}
    </ScrollView>
  );
}

function ClientModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ name:'', contact_person:'', phone:'', email:'', inn:'', city:'', address:'', payment_terms:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Ошибка','Введите название компании'); return; }
    setSaving(true);
    try { await api.clients.create(form); onSaved(); }
    catch(e:any) { Alert.alert('Ошибка', e.message||'Не удалось сохранить'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Новый клиент</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#5A6573" /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              {k:'name',label:'НАЗВАНИЕ КОМПАНИИ *',ph:'ООО Логистик-Прайм'},
              {k:'contact_person',label:'КОНТАКТНОЕ ЛИЦО',ph:'Иванов И.И.'},
              {k:'phone',label:'ТЕЛЕФОН',ph:'+375 (29) 000-00-00'},
              {k:'email',label:'EMAIL',ph:'info@company.ru'},
              {k:'inn',label:'УНП / ИНН',ph:'191234567'},
              {k:'city',label:'ГОРОД',ph:'Минск'},
              {k:'address',label:'ЮРИДИЧЕСКИЙ АДРЕС',ph:'г. Минск, ул. ...'},
              {k:'payment_terms',label:'УСЛОВИЯ ОПЛАТЫ',ph:'10 дней'},
              {k:'notes',label:'ПРИМЕЧАНИЯ',ph:''},
            ].map(f=>(
              <View key={f.k} style={styles.formGroup}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput style={styles.formInput} value={(form as any)[f.k]} onChangeText={v=>set(f.k,v)}
                  placeholder={f.ph} placeholderTextColor="#A6AEB8" multiline={f.k==='notes'} />
              </View>
            ))}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveText}>{saving?'Сохранение…':'Создать'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  searchBox:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,paddingVertical:10,borderRadius:13,backgroundColor:'rgba(255,255,255,0.6)',borderWidth:1,borderColor:'rgba(14,23,38,0.08)'},
  searchInput:{flex:1,fontFamily:'Manrope_400Regular',fontSize:13.5,color:'#0E1726'},
  count:{fontFamily:'Manrope_500Medium',fontSize:13,color:'#8A93A0'},
  countNum:{fontFamily:'Onest_700Bold',color:'#0E1726'},
  loaderWrap:{paddingVertical:40,alignItems:'center'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:16},
  card:{width:'48%',borderRadius:22,padding:22,backgroundColor:'rgba(255,255,255,0.6)',borderWidth:1,borderColor:'rgba(255,255,255,0.7)',shadowColor:'#0E1726',shadowOffset:{width:0,height:10},shadowOpacity:0.1,shadowRadius:28},
  cardTop:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:16},
  avatar:{width:50,height:50,borderRadius:15,alignItems:'center',justifyContent:'center'},
  avatarText:{color:'#fff',fontFamily:'Onest_700Bold',fontSize:17},
  name:{fontFamily:'Onest_700Bold',fontSize:16,color:'#0E1726'},
  sub:{fontFamily:'Manrope_400Regular',fontSize:12.5,color:'#8A93A0',marginTop:2},
  stats:{flexDirection:'row',gap:10,marginBottom:14},
  stat:{flex:1,borderRadius:13,padding:12,backgroundColor:'rgba(14,23,38,0.035)'},
  statLabel:{fontFamily:'Manrope_400Regular',fontSize:11,color:'#8A93A0',marginBottom:4},
  statVal:{fontFamily:'Onest_700Bold',fontSize:15,color:'#0E1726'},
  meta:{fontFamily:'Manrope_400Regular',fontSize:12.5,color:'#5A6573',marginBottom:14},
  cardActions:{flexDirection:'row',gap:8,justifyContent:'flex-end'},
  actionBtn:{width:38,height:38,borderRadius:11,backgroundColor:'rgba(19,102,240,0.08)',borderWidth:1,borderColor:'rgba(19,102,240,0.2)',alignItems:'center',justifyContent:'center'},
  actionBtnGhost:{width:38,height:38,borderRadius:11,backgroundColor:'rgba(255,255,255,0.6)',borderWidth:1,borderColor:'rgba(14,23,38,0.1)',alignItems:'center',justifyContent:'center'},
  empty:{fontFamily:'Manrope_400Regular',fontSize:13.5,color:'#A6AEB8',textAlign:'center',padding:40,width:'100%'},
  overlay:{flex:1,backgroundColor:'rgba(20,28,46,0.34)',alignItems:'center',justifyContent:'center',padding:28},
  modal:{width:'100%',maxWidth:480,maxHeight:'90%',backgroundColor:'rgba(255,255,255,0.96)',borderRadius:26,borderWidth:1,borderColor:'rgba(255,255,255,0.9)',shadowColor:'#0E1726',shadowOffset:{width:0,height:40},shadowOpacity:0.4,shadowRadius:60,padding:24},
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
