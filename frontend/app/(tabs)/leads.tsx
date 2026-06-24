import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Phone, Clock } from 'lucide-react-native';
import { api } from '../../src/api';

const LEAD_META: Record<string,{label:string;color:string;bg:string}> = {
  new:       { label:'Новый',       color:'#1366F0', bg:'rgba(19,102,240,0.12)'  },
  thinking:  { label:'Думают',      color:'#D97706', bg:'rgba(217,119,6,0.14)'   },
  sent_kp:   { label:'Выслал КП',   color:'#C2410C', bg:'rgba(194,65,12,0.12)'   },
  won:       { label:'Клиент',      color:'#1E9E5A', bg:'rgba(30,158,90,0.14)'   },
  lost:      { label:'Потерян',     color:'#8A93A0', bg:'rgba(138,147,160,0.14)' },
  callback:  { label:'Перезвонить', color:'#7C3AED', bg:'rgba(124,58,237,0.12)'  },
};
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
const fmtDate=(s:string)=>{ if(!s) return '—'; const p=s.split('-'); return `${p[2]}.${p[1]}`; };
const today=new Date().toISOString().slice(0,10);

const FILTERS = [
  {k:'all',label:'Все'},{k:'new',label:'Новые'},{k:'callback',label:'Перезвон'},
  {k:'sent_kp',label:'КП'},{k:'won',label:'Клиенты'},
];

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [noteModal, setNoteModal] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLeads(await api.leads.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const filtered = leads
    .filter(l => filter==='all' || l.status===filter)
    .filter(l => !q || (l.name||'').toLowerCase().includes(q) || (l.company||'').toLowerCase().includes(q));

  const counts: Record<string,number> = { all: leads.length };
  FILTERS.slice(1).forEach(f => { counts[f.k] = leads.filter(l=>l.status===f.k).length; });

  const updateStatus = async (l: any, status: string) => {
    try { await api.leads.update(l.id, { ...l, status }); load(); } catch {}
  };

  // Stats
  const callsToday = leads.filter(l=>l.next_call===today||l.nextCall===today).length;
  const inWork = leads.filter(l=>l.status!=='won'&&l.status!=='lost').length;
  const wonCount = leads.filter(l=>l.status==='won').length;
  const convPct = leads.length ? Math.round(wonCount/leads.length*100) : 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Обзвон</Text>
        <View style={{flex:1}} />
        <TouchableOpacity style={styles.addBtn} onPress={()=>setShowModal(true)}>
          <Plus size={16} color="#fff" strokeWidth={2.2} />
          <Text style={styles.addBtnText}>Новый лид</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.page}>
        {/* KPI strip */}
        <View style={styles.kpiRow}>
          {[
            {label:'Всего лидов', val:String(leads.length), color:'#1366F0', bg:'rgba(19,102,240,0.12)'},
            {label:'Звонков сегодня', val:String(callsToday), color:'#D97706', bg:'rgba(217,119,6,0.12)'},
            {label:'В работе', val:String(inWork), color:'#7C3AED', bg:'rgba(124,58,237,0.12)'},
            {label:'Конверсия', val:convPct+'%', color:'#1E9E5A', bg:'rgba(30,158,90,0.12)'},
          ].map((kpi,i)=>(
            <View key={i} style={styles.kpiCard}>
              <View style={[styles.kpiDot,{backgroundColor:kpi.bg}]}><View style={[styles.kpiDotInner,{backgroundColor:kpi.color}]}/></View>
              <Text style={[styles.kpiVal,{color:kpi.color}]}>{kpi.val}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(f=>(
            <TouchableOpacity key={f.k} style={[styles.chip,filter===f.k&&styles.chipActive]}
              onPress={()=>setFilter(f.k)} activeOpacity={0.7}>
              <Text style={[styles.chipText,filter===f.k&&styles.chipTextActive]}>{f.label}  {counts[f.k]??0}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search */}
        <View style={styles.searchBox}>
          <Phone size={15} color="#8A93A0" strokeWidth={1.9} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Поиск по лидам…" placeholderTextColor="#A6AEB8" />
        </View>

        {loading ? (
          <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>
        ) : (
          <View style={styles.grid}>
            {filtered.length===0 && <Text style={styles.empty}>Лидов нет</Text>}
            {filtered.map((l,i)=>{
              const meta = LEAD_META[l.status] || LEAD_META.new;
              const [a,b] = GRADIENTS[avatarIdx(l.name||'')];
              const nextCall = l.next_call||l.nextCall||'';
              const overdue = nextCall && nextCall<today;
              const notes = l.notes||l.description||'';
              const isOpen = l.status!=='won'&&l.status!=='lost';
              return (
                <View key={l.id||i} style={styles.card}>
                  <View style={styles.cardTop}>
                    <LinearGradient colors={[a,b]} style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(l.name||'')}</Text>
                    </LinearGradient>
                    <View style={{flex:1,minWidth:0}}>
                      <Text style={styles.leadName} numberOfLines={1}>{l.name}</Text>
                      <Text style={styles.leadSub} numberOfLines={1}>{[l.company,l.city].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <View style={[styles.badge,{backgroundColor:meta.bg}]}>
                      <Text style={[styles.badgeText,{color:meta.color}]}>{meta.label}</Text>
                    </View>
                  </View>
                  {notes ? <Text style={styles.leadNotes} numberOfLines={3}>{notes}</Text> : null}
                  <View style={styles.cardFooter}>
                    <View style={styles.nextCallRow}>
                      <Clock size={13} color={overdue?'#E0473B':'#D97706'} />
                      <Text style={[styles.nextCallText,overdue&&{color:'#E0473B'}]}>
                        {nextCall ? `Звонок ${fmtDate(nextCall)}` : 'Нет звонка'}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      {isOpen && (
                        <>
                          <TouchableOpacity style={styles.actionBtnGhost} onPress={()=>updateStatus(l,'thinking')}>
                            <Text style={styles.actionBtnGhostText}>В работу</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.actionBtnGreen} onPress={()=>updateStatus(l,'won')}>
                            <Text style={styles.actionBtnGreenText}>Клиент</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity style={styles.callBtn} onPress={()=>setNoteModal(l)}>
                        <Phone size={14} color="#fff" fill="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showModal && <LeadModal onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load();}} />}
      {noteModal && <NoteModal lead={noteModal} onClose={()=>setNoteModal(null)} onSaved={()=>{setNoteModal(null);load();}} />}
    </ScrollView>
  );
}

function LeadModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ name:'', company:'', phone:'', city:'', status:'new', notes:'', next_call:'' });
  const [saving, setSaving] = useState(false);
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Ошибка','Введите имя'); return; }
    setSaving(true);
    try { await api.leads.create(form); onSaved(); }
    catch(e:any) { Alert.alert('Ошибка', e.message||'Ошибка'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Новый лид</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#5A6573" /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              {k:'name',label:'ИМЯ *',ph:'Иванов Иван'},
              {k:'company',label:'КОМПАНИЯ',ph:'ООО Логистик'},
              {k:'phone',label:'ТЕЛЕФОН',ph:'+7 (495) 000-00-00'},
              {k:'city',label:'ГОРОД',ph:'Москва'},
              {k:'next_call',label:'ДАТА СЛЕДУЮЩЕГО ЗВОНКА',ph:'2026-02-15'},
              {k:'notes',label:'ЗАМЕТКИ',ph:''},
            ].map(f=>(
              <View key={f.k} style={styles.formGroup}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput style={styles.formInput} value={(form as any)[f.k]} onChangeText={v=>set(f.k,v)}
                  placeholder={f.ph} placeholderTextColor="#A6AEB8" multiline={f.k==='notes'} />
              </View>
            ))}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}><Text style={styles.saveText}>{saving?'Сохранение…':'Создать'}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function NoteModal({ lead, onClose, onSaved }: { lead:any; onClose:()=>void; onSaved:()=>void }) {
  const [note, setNote] = useState('');
  const [nextCall, setNextCall] = useState(lead.next_call||lead.nextCall||'');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (note.trim()) await api.leads.addCallNote(lead.id, note.trim());
      await api.leads.update(lead.id, { ...lead, next_call: nextCall });
      onSaved();
    } catch(e:any) { Alert.alert('Ошибка', e.message||'Ошибка'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Запись звонка</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#5A6573" /></TouchableOpacity>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>ИТОГ РАЗГОВОРА</Text>
            <TextInput style={[styles.formInput,{minHeight:80}]} value={note} onChangeText={setNote}
              placeholder="Обсудили условия, клиент думает..." placeholderTextColor="#A6AEB8" multiline />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>СЛЕДУЮЩИЙ ЗВОНОК</Text>
            <TextInput style={styles.formInput} value={nextCall} onChangeText={setNextCall}
              placeholder="2026-02-20" placeholderTextColor="#A6AEB8" />
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Отмена</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}><Text style={styles.saveText}>{saving?'Сохранение…':'Сохранить'}</Text></TouchableOpacity>
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
  kpiRow:{flexDirection:'row',gap:16},
  kpiCard:{flex:1,borderRadius:20,padding:18,backgroundColor:'rgba(255,255,255,0.6)',borderWidth:1,borderColor:'rgba(255,255,255,0.7)',shadowColor:'#0E1726',shadowOffset:{width:0,height:8},shadowOpacity:0.1,shadowRadius:20},
  kpiDot:{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center',marginBottom:10},
  kpiDotInner:{width:9,height:9,borderRadius:5},
  kpiVal:{fontFamily:'Onest_800ExtraBold',fontSize:24,letterSpacing:-0.5,marginBottom:4},
  kpiLabel:{fontFamily:'Manrope_500Medium',fontSize:12,color:'#8A93A0'},
  chips:{flexDirection:'row',gap:9},
  chip:{paddingHorizontal:15,paddingVertical:8,borderRadius:11,backgroundColor:'rgba(255,255,255,0.5)',borderWidth:1,borderColor:'rgba(14,23,38,0.08)'},
  chipActive:{backgroundColor:'#0E1726',borderColor:'transparent'},
  chipText:{fontFamily:'Manrope_600SemiBold',fontSize:13,color:'#5A6573'},
  chipTextActive:{color:'#fff'},
  searchBox:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,paddingVertical:10,borderRadius:13,backgroundColor:'rgba(255,255,255,0.6)',borderWidth:1,borderColor:'rgba(14,23,38,0.08)'},
  searchInput:{flex:1,fontFamily:'Manrope_400Regular',fontSize:13.5,color:'#0E1726'},
  loaderWrap:{paddingVertical:40,alignItems:'center'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:16},
  card:{width:'48%',borderRadius:22,padding:20,backgroundColor:'rgba(255,255,255,0.6)',borderWidth:1,borderColor:'rgba(255,255,255,0.7)',shadowColor:'#0E1726',shadowOffset:{width:0,height:10},shadowOpacity:0.1,shadowRadius:28},
  cardTop:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12},
  avatar:{width:46,height:46,borderRadius:14,alignItems:'center',justifyContent:'center',flexShrink:0},
  avatarText:{color:'#fff',fontFamily:'Onest_700Bold',fontSize:15},
  leadName:{fontFamily:'Onest_700Bold',fontSize:15.5,color:'#0E1726'},
  leadSub:{fontFamily:'Manrope_400Regular',fontSize:12.5,color:'#8A93A0',marginTop:2},
  badge:{paddingHorizontal:10,paddingVertical:4,borderRadius:9,flexShrink:0},
  badgeText:{fontFamily:'Manrope_700Bold',fontSize:11.5,fontWeight:'700'},
  leadNotes:{fontFamily:'Manrope_400Regular',fontSize:12.5,color:'#5A6573',lineHeight:18,marginBottom:14},
  cardFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:'rgba(14,23,38,0.06)'},
  nextCallRow:{flexDirection:'row',alignItems:'center',gap:5},
  nextCallText:{fontFamily:'Onest_700Bold',fontSize:12,color:'#D97706'},
  cardActions:{flexDirection:'row',gap:7},
  actionBtnGhost:{paddingHorizontal:12,paddingVertical:7,borderRadius:10,borderWidth:1,borderColor:'rgba(14,23,38,0.1)',backgroundColor:'rgba(255,255,255,0.6)'},
  actionBtnGhostText:{fontFamily:'Manrope_600SemiBold',fontSize:12.5,color:'#5A6573'},
  actionBtnGreen:{paddingHorizontal:12,paddingVertical:7,borderRadius:10,backgroundColor:'#1E9E5A'},
  actionBtnGreenText:{fontFamily:'Manrope_600SemiBold',fontSize:12.5,color:'#fff'},
  callBtn:{width:36,height:36,borderRadius:10,backgroundColor:'#0E1726',alignItems:'center',justifyContent:'center'},
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
