import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, X, Check, Calendar } from 'lucide-react-native';
import { api } from '../../src/api';

const PRIORITY_META: Record<string,{label:string;color:string;bg:string}> = {
  high:  { label:'Высокий', color:'#E0473B', bg:'rgba(224,71,59,0.12)' },
  med:   { label:'Средний', color:'#D97706', bg:'rgba(217,119,6,0.12)' },
  medium:{ label:'Средний', color:'#D97706', bg:'rgba(217,119,6,0.12)' },
  low:   { label:'Низкий',  color:'#1E9E5A', bg:'rgba(30,158,90,0.12)' },
};
const TYPE_META: Record<string,{label:string;color:string;bg:string}> = {
  call:    { label:'Звонок',    color:'#7C3AED', bg:'rgba(124,58,237,0.12)' },
  payment: { label:'Оплата',    color:'#1E9E5A', bg:'rgba(30,158,90,0.12)' },
  invoice: { label:'Счёт',      color:'#1366F0', bg:'rgba(19,102,240,0.12)' },
  payout:  { label:'Выплата',   color:'#D97706', bg:'rgba(217,119,6,0.12)' },
  docs:    { label:'Документы', color:'#5A6573', bg:'rgba(14,23,38,0.07)'  },
  deal:    { label:'Сделка',    color:'#0CA6C0', bg:'rgba(12,166,192,0.12)' },
  kp:      { label:'КП',        color:'#C2410C', bg:'rgba(194,65,12,0.12)' },
  report:  { label:'Отчёт',     color:'#8A93A0', bg:'rgba(138,147,160,0.12)' },
  other:   { label:'Другое',    color:'#A6AEB8', bg:'rgba(166,174,184,0.12)' },
};
const fmtDate = (s:string) => { if(!s) return '—'; const p=s.split('-'); return p[2]+'.'+p[1]; };
const FILTERS = [
  {k:'open',label:'Активные'},{k:'all',label:'Все'},{k:'overdue',label:'Просроченные'},{k:'done',label:'Выполнены'},
];

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTasks(await api.tasks.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = new Date().toISOString().slice(0,10);
  const filtered = tasks.filter(t => {
    if (filter==='done') return t.done||t.status==='done';
    if (filter==='open') return !t.done && t.status!=='done';
    if (filter==='overdue') return !t.done && t.due_date && t.due_date<today;
    return true;
  });

  const toggleTask = async (t: any) => {
    const done = !(t.done||t.status==='done');
    try { await api.tasks.update(t.id, { ...t, done, status: done?'done':'open' }); load(); }
    catch {}
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Задачи</Text>
        <View style={{flex:1}} />
        <TouchableOpacity style={styles.addBtn} onPress={()=>setShowModal(true)}>
          <Plus size={16} color="#fff" strokeWidth={2.2} />
          <Text style={styles.addBtnText}>Новая задача</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.page}>
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(f => {
            const cnt = f.k==='all'?tasks.length:f.k==='done'?tasks.filter(t=>t.done||t.status==='done').length:f.k==='overdue'?tasks.filter(t=>!t.done&&t.due_date&&t.due_date<today).length:tasks.filter(t=>!t.done&&t.status!=='done').length;
            return (
              <TouchableOpacity key={f.k} style={[styles.chip,filter===f.k&&styles.chipActive]}
                onPress={()=>setFilter(f.k)} activeOpacity={0.7}>
                <Text style={[styles.chipText,filter===f.k&&styles.chipTextActive]}>{f.label}  {cnt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loaderWrap}><ActivityIndicator color="#1366F0" size="large" /></View>
        ) : (
          <View style={styles.tableWrap}>
            {filtered.length===0 && <Text style={styles.empty}>Задач нет</Text>}
            {filtered.map((t,i) => {
              const done = t.done||t.status==='done';
              const prio = PRIORITY_META[t.priority||t.prio||'low'] || PRIORITY_META.low;
              const type = TYPE_META[t.task_type||t.type||'other'] || TYPE_META.other;
              const due = t.due_date||t.due||'';
              const overdue = !done && due && due<today;
              const rel = t.related_order||t.related||t.rel||'';
              return (
                <View key={t.id||i} style={[styles.row, i===filtered.length-1&&{borderBottomWidth:0}]}>
                  {/* Checkbox */}
                  <TouchableOpacity style={[styles.checkbox, done&&styles.checkboxDone]} onPress={()=>toggleTask(t)}>
                    {done && <Check size={13} color="#fff" strokeWidth={3} />}
                  </TouchableOpacity>
                  {/* Content */}
                  <View style={{flex:1,minWidth:0}}>
                    <Text style={[styles.taskTitle,done&&styles.taskTitleDone]} numberOfLines={2}>{t.title}</Text>
                    {rel ? <Text style={styles.taskRel} numberOfLines={1}>{rel}</Text> : null}
                  </View>
                  {/* Type badge */}
                  <View style={[styles.badge,{backgroundColor:type.bg}]}>
                    <Text style={[styles.badgeText,{color:type.color}]}>{type.label}</Text>
                  </View>
                  {/* Priority */}
                  <View style={[styles.badge,{backgroundColor:prio.bg}]}>
                    <Text style={[styles.badgeText,{color:prio.color}]}>{prio.label}</Text>
                  </View>
                  {/* Due date */}
                  <View style={styles.dueWrap}>
                    <Calendar size={12} color={overdue?'#E0473B':'#A6AEB8'} />
                    <Text style={[styles.dueText,overdue&&{color:'#E0473B'}]}>{fmtDate(due)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showModal && <TaskModal onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load();}} />}
    </ScrollView>
  );
}

function TaskModal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ title:'', task_type:'call', priority:'med', due_date:'', related:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert('Ошибка','Введите название задачи'); return; }
    setSaving(true);
    try { await api.tasks.create({ ...form, done:false, status:'open' }); onSaved(); }
    catch(e:any) { Alert.alert('Ошибка', e.message||'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Новая задача</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#5A6573" /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ЗАДАЧА *</Text>
              <TextInput style={styles.formInput} value={form.title} onChangeText={v=>set('title',v)} placeholder="Описание задачи" placeholderTextColor="#A6AEB8" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>СРОК ВЫПОЛНЕНИЯ</Text>
              <TextInput style={styles.formInput} value={form.due_date} onChangeText={v=>set('due_date',v)} placeholder="2026-02-15" placeholderTextColor="#A6AEB8" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>СВЯЗАННАЯ ЗАЯВКА / ЛИД</Text>
              <TextInput style={styles.formInput} value={form.related} onChangeText={v=>set('related',v)} placeholder="№2025-0142" placeholderTextColor="#A6AEB8" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ПРИМЕЧАНИЯ</Text>
              <TextInput style={styles.formInput} value={form.notes} onChangeText={v=>set('notes',v)} placeholder="" placeholderTextColor="#A6AEB8" multiline />
            </View>
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

const styles = StyleSheet.create({
  scroll:{flex:1,backgroundColor:'#EDEFF3'}, content:{},
  topbar:{flexDirection:'row',alignItems:'center',paddingHorizontal:24,paddingVertical:14,backgroundColor:'rgba(237,239,243,0.9)',borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.5)',gap:12},
  topTitle:{fontFamily:'Onest_700Bold',fontSize:22,color:'#0E1726',letterSpacing:-0.5},
  addBtn:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:18,paddingVertical:11,borderRadius:13,backgroundColor:'#0E1726',shadowColor:'#0E1726',shadowOffset:{width:0,height:8},shadowOpacity:0.5,shadowRadius:16},
  addBtnText:{fontFamily:'Manrope_600SemiBold',fontSize:13.5,color:'#fff'},
  page:{padding:24,gap:16},
  chips:{flexDirection:'row',gap:9},
  chip:{paddingHorizontal:15,paddingVertical:8,borderRadius:11,backgroundColor:'rgba(255,255,255,0.5)',borderWidth:1,borderColor:'rgba(14,23,38,0.08)'},
  chipActive:{backgroundColor:'#0E1726',borderColor:'transparent'},
  chipText:{fontFamily:'Manrope_600SemiBold',fontSize:13,color:'#5A6573'},
  chipTextActive:{color:'#fff'},
  loaderWrap:{paddingVertical:40,alignItems:'center'},
  tableWrap:{borderRadius:22,overflow:'hidden',backgroundColor:'rgba(255,255,255,0.58)',borderWidth:1,borderColor:'rgba(255,255,255,0.72)',shadowColor:'#0E1726',shadowOffset:{width:0,height:12},shadowOpacity:0.1,shadowRadius:28},
  row:{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:22,paddingVertical:16,borderBottomWidth:1,borderBottomColor:'rgba(14,23,38,0.05)'},
  checkbox:{width:26,height:26,borderRadius:8,borderWidth:2,borderColor:'rgba(14,23,38,0.18)',backgroundColor:'transparent',alignItems:'center',justifyContent:'center',flexShrink:0},
  checkboxDone:{backgroundColor:'#1E9E5A',borderColor:'#1E9E5A'},
  taskTitle:{fontFamily:'Manrope_600SemiBold',fontSize:13.5,color:'#0E1726'},
  taskTitleDone:{textDecorationLine:'line-through',color:'#A6AEB8'},
  taskRel:{fontFamily:'Manrope_400Regular',fontSize:12,color:'#8A93A0',marginTop:3},
  badge:{paddingHorizontal:9,paddingVertical:4,borderRadius:8,flexShrink:0},
  badgeText:{fontFamily:'Manrope_700Bold',fontSize:11,fontWeight:'700'},
  dueWrap:{flexDirection:'row',alignItems:'center',gap:5,flexShrink:0},
  dueText:{fontFamily:'Onest_700Bold',fontSize:12,color:'#5A6573'},
  empty:{fontFamily:'Manrope_400Regular',fontSize:13.5,color:'#A6AEB8',textAlign:'center',padding:40},
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
