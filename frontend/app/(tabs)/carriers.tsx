import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, Plus, X, Star } from 'lucide-react-native';
import { api } from '../../src/api';

const GRADIENTS = [
  ['#FFD8A8','#FF922B'],['#D0BFFF','#7C3AED'],['#A5D8FF','#1366F0'],
  ['#B2F2BB','#1E9E5A'],['#FFC9C9','#E0473B'],['#99E9F2','#0CA6C0'],
];
const avatarIdx = (n:string)=>n.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%GRADIENTS.length;
const initials = (name:string)=>{
  const clean=(name||'').replace(/^(ООО|АО|ОАО|ЗАО|ТД|ИП|ПАО)\s+/i,'').trim();
  const w=clean.split(/[\s-]+/).filter(Boolean);
  return ((w[0]?.[0]||'')+(w[1]?.[0]||w[0]?.[1]||'')).toUpperCase();
};

export default function Carriers() {
  const router = useRouter();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCarriers(await api.carriers.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? carriers.filter(c=>[c.company_name,c.driver_name,c.phone,c.plate].some(f=>(f||'').toLowerCase().includes(q)))
    : carriers;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Перевозчики</Text>
        <View style={{flex:1}} />
        <TouchableOpacity style={styles.addBtn} onPress={()=>setShowModal(true)}>
          <Plus size={16} color="#fff" strokeWidth={2.2} />
          <Text style={styles.addBtnText}>Добавить перевозчика</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.page}>
        <View style={styles.searchBox}>
          <Search size={16} color="#8A93A0" strokeWidth={1.9} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Поиск по перевозчикам…" placeholderTextColor="#A6AEB8" />
        </View>

        <Text style={styles.count}>Всего перевозчиков: <Text style={styles.countNum}>{filtered.length}</Text></Text>

        {loading ? (
          <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>
        ) : (
          <View style={styles.grid}>
            {filtered.length===0 && <Text style={styles.empty}>Перевозчиков нет</Text>}
            {filtered.map((c,i) => {
              const [a,b] = GRADIENTS[avatarIdx(c.company_name||'')];
              const rating = c.rating ? Number(c.rating).toFixed(1) : null;
              const cap = [c.vehicle_type, c.capacity].filter(Boolean).join(' · ');
              return (
                <TouchableOpacity key={c.id||i} style={styles.card}
                  onPress={()=>router.push(`/carrier/${c.id}` as any)} activeOpacity={0.8}>
                  <View style={styles.cardTop}>
                    <LinearGradient colors={[a,b]} style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(c.company_name||'')}</Text>
                    </LinearGradient>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={styles.name} numberOfLines={1}>{c.company_name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{c.driver_name||'—'}</Text>
                    </View>
                    {rating && (
                      <View style={styles.ratingBadge}>
                        <Star size={11} color="#D97706" fill="#D97706" />
                        <Text style={styles.ratingText}>{rating}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.tags}>
                    {cap ? <View style={styles.tag}><Text style={styles.tagText}>{cap}</Text></View> : null}
                    {c.plate ? <View style={[styles.tag,styles.tagMono]}><Text style={[styles.tagText,styles.tagTextMono]}>{c.plate}</Text></View> : null}
                  </View>
                  {c.phone && <Text style={styles.phone}>{c.phone}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {showModal && <CarrierModal onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load();}} />}
    </ScrollView>
  );
}

function CarrierModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ company_name:'', driver_name:'', phone:'', email:'', plate:'', vehicle_type:'', capacity:'', rating:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.company_name.trim()) { Alert.alert('Ошибка','Введите название'); return; }
    setSaving(true);
    try { await api.carriers.create(form); onSaved(); }
    catch(e:any) { Alert.alert('Ошибка', e.message||'Не удалось сохранить'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Новый перевозчик</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#5A6573" /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              {k:'company_name',label:'НАЗВАНИЕ / ИП *',ph:'ИП Морозов А.Н.'},
              {k:'driver_name',label:'ВОДИТЕЛЬ',ph:'Морозов Андрей Николаевич'},
              {k:'phone',label:'ТЕЛЕФОН',ph:'+375 (29) 000-00-00'},
              {k:'vehicle_type',label:'ТИП ТС',ph:'Тент, рефрижератор…'},
              {k:'plate',label:'ГОС. НОМЕР',ph:'AB 1234-7'},
              {k:'capacity',label:'ГРУЗОПОДЪЁМНОСТЬ',ph:'20 т · 86 м³'},
              {k:'rating',label:'РЕЙТИНГ (0-5)',ph:'4.8'},
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
  ratingBadge:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(217,119,6,0.1)',paddingHorizontal:8,paddingVertical:4,borderRadius:9},
  ratingText:{fontFamily:'Onest_700Bold',fontSize:12,color:'#A86A20'},
  tags:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},
  tag:{paddingHorizontal:12,paddingVertical:7,borderRadius:10,backgroundColor:'rgba(14,23,38,0.05)'},
  tagMono:{},
  tagText:{fontFamily:'Manrope_600SemiBold',fontSize:12.5,color:'#0E1726'},
  tagTextMono:{fontFamily:'Onest_700Bold'},
  phone:{fontFamily:'Manrope_400Regular',fontSize:12.5,color:'#5A6573'},
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
