import React, { useState, useEffect, useCallback } from 'react';
import { api, initials, avatarIdx, GRADIENTS } from '../api.js';

const STATUSES = ['new', 'contacted', 'interested', 'negotiation', 'won', 'lost'];
const STATUS_LABELS = { new:'Новый', contacted:'Связались', interested:'Заинтересован', negotiation:'Переговоры', won:'Клиент', lost:'Отказ' };
const STATUS_COLORS = {
  new:         { color:'#1366F0', bg:'rgba(19,102,240,0.1)' },
  contacted:   { color:'#0891B2', bg:'rgba(8,145,178,0.1)' },
  interested:  { color:'#D97706', bg:'rgba(217,119,6,0.1)' },
  negotiation: { color:'#7C3AED', bg:'rgba(124,58,237,0.1)' },
  won:         { color:'#1E9E5A', bg:'rgba(30,158,90,0.1)' },
  lost:        { color:'#E0473B', bg:'rgba(224,71,59,0.1)' },
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [industry, setIndustry] = useState('');
  const [industries, setIndustries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [noteModal, setNoteModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, ind] = await Promise.all([
        api.leads.list(industry || undefined),
        api.leads.industries().catch(() => []),
      ]);
      setLeads(l);
      setIndustries(ind);
    } catch {} finally { setLoading(false); }
  }, [industry]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (lead, newStatus) => {
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
    try { await api.leads.update(lead.id, { status: newStatus }); }
    catch { load(); }
  };

  const q = search.trim().toLowerCase();
  const filtered = leads.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (q && !(l.company_name || '').toLowerCase().includes(q) && !(l.contact_name || '').toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = {};
  STATUSES.forEach(s => counts[s] = leads.filter(l => l.status === s).length);
  const total = leads.length;
  const wonCount = counts.won || 0;
  const convRate = total > 0 ? ((wonCount / total) * 100).toFixed(0) : 0;

  const now = new Date();
  const urgentLeads = leads.filter(l => l.next_call && new Date(l.next_call) <= now && l.status !== 'won' && l.status !== 'lost');

  return (
    <div className="page-content">
      {/* Stats strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        {[
          { label:'Всего лидов', val: total, color:'#1366F0' },
          { label:'В работе', val: leads.filter(l => !['won','lost'].includes(l.status)).length, color:'#D97706' },
          { label:'Стали клиентами', val: wonCount, color:'#1E9E5A' },
          { label:'Конверсия', val: convRate + '%', color:'#7C3AED' },
        ].map((s, i) => (
          <div key={i} className="glass-card kpi-card">
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:26, color: s.color }}>{s.val}</div>
            <div style={{ fontSize:12, color:'#8A93A0', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="glass-card">
        <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726', marginBottom:16 }}>Воронка продаж</div>
        {STATUSES.filter(s => s !== 'lost').map(s => {
          const cnt = counts[s] || 0;
          const pct = total > 0 ? (cnt / total) * 100 : 0;
          const sc = STATUS_COLORS[s];
          return (
            <div key={s} className="funnel-bar-row">
              <div style={{ width:110, fontSize:12.5, fontWeight:600, color:'#5A6573', flexShrink:0 }}>{STATUS_LABELS[s]}</div>
              <div className="funnel-bar-bg">
                <div className="funnel-bar-fill" style={{ width: pct + '%', background: sc.color, opacity:0.8 }} />
              </div>
              <div style={{ width:36, textAlign:'right', fontSize:13, fontWeight:700, color: sc.color, flexShrink:0 }}>{cnt}</div>
            </div>
          );
        })}
      </div>

      {/* Urgent */}
      {urgentLeads.length > 0 && (
        <div className="glass-card" style={{ borderLeft:'3px solid #E0473B' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
            <span style={{ fontSize:16 }}>⏰</span>
            <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#E0473B' }}>Перезвонить сейчас ({urgentLeads.length})</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {urgentLeads.slice(0,5).map(l => (
              <div key={l.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:13, background:'rgba(224,71,59,0.06)', border:'1px solid rgba(224,71,59,0.15)' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#0E1726' }}>{l.company_name}</div>
                  <div style={{ fontSize:12, color:'#8A93A0' }}>{l.contact_name} · {l.phone}</div>
                </div>
                <button style={{ background:'none', border:'none', cursor:'pointer', color:'#1366F0', fontSize:13, fontWeight:600 }}
                  onClick={() => setNoteModal(l)}>+ Заметка</button>
                {l.phone && (
                  <a href={`tel:${l.phone}`} style={{ padding:'8px 14px', borderRadius:10, background:'#E0473B', color:'#fff', fontSize:12.5, fontWeight:600, textDecoration:'none' }}>
                    Позвонить
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div className="inline-search" style={{ flex:1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по лидам…" />
        </div>
        {industries.length > 0 && (
          <select className="form-input form-select" value={industry} onChange={e => setIndustry(e.target.value)} style={{ width:180 }}>
            <option value="">Все отрасли</option>
            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        )}
        <button className="btn-dark" onClick={() => { setEditLead(null); setShowModal(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить лид
        </button>
      </div>

      {/* Status chips */}
      <div className="chip-row">
        <div className={`chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
          Все <span className="chip-count">{total}</span>
        </div>
        {STATUSES.map(s => (
          <div key={s} className={`chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {STATUS_LABELS[s]}
            <span className="chip-count">{counts[s] || 0}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
          {filtered.length === 0 && <div className="empty-state" style={{ gridColumn:'1/-1' }}>Лидов нет</div>}
          {filtered.map(l => (
            <LeadCard key={l.id} lead={l} onEdit={() => { setEditLead(l); setShowModal(true); }}
              onStatusChange={(s) => updateStatus(l, s)}
              onAddNote={() => setNoteModal(l)} />
          ))}
        </div>
      )}

      {showModal && (
        <LeadModal lead={editLead} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
      {noteModal && (
        <NoteModal lead={noteModal} onClose={() => setNoteModal(null)} onSaved={() => { setNoteModal(null); load(); }} />
      )}
    </div>
  );
}

function LeadCard({ lead, onEdit, onStatusChange, onAddNote }) {
  const sc = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
  const idx = avatarIdx(lead.company_name || '');
  const [a, b] = GRADIENTS[idx];
  const now = new Date();
  const nextCallOverdue = lead.next_call && new Date(lead.next_call) < now;

  return (
    <div className="lead-card">
      <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:12 }}>
        <span style={{ width:42, height:42, borderRadius:13, background:`linear-gradient(145deg,${a},${b})`, color:'#fff', fontFamily:'Onest', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {initials(lead.company_name || '')}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#0E1726', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.company_name}</div>
          <div style={{ fontSize:12, color:'#8A93A0' }}>{lead.contact_name || lead.phone || '—'}</div>
        </div>
        <span className="status-badge" style={{ color: sc.color, background: sc.bg, flexShrink:0 }}>{STATUS_LABELS[lead.status]}</span>
      </div>

      {lead.industry && <div style={{ fontSize:11.5, color:'#8A93A0', marginBottom:10 }}>🏢 {lead.industry}</div>}

      {lead.next_call && (
        <div style={{ fontSize:12, fontWeight: nextCallOverdue ? 700 : 500, color: nextCallOverdue ? '#E0473B' : '#8A93A0', marginBottom:8 }}>
          {nextCallOverdue ? '⚠ Перезвонить: ' : '📅 Следующий звонок: '}
          {new Date(lead.next_call).toLocaleDateString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
        </div>
      )}

      {lead.call_notes && lead.call_notes.length > 0 && (
        <div style={{ fontSize:12, color:'#5A6573', borderLeft:'2px solid rgba(14,23,38,0.1)', paddingLeft:10, marginBottom:10, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {lead.call_notes[lead.call_notes.length - 1]?.text || ''}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <select
          value={lead.status}
          onChange={e => onStatusChange(e.target.value)}
          className="form-input form-select"
          style={{ flex:1, padding:'7px 10px', fontSize:12.5 }}
          onClick={e => e.stopPropagation()}
        >
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn-ghost btn-sm" onClick={onAddNote}>Заметка</button>
        <button className="btn-ghost btn-sm" onClick={onEdit}>✎</button>
      </div>
    </div>
  );
}

function LeadModal({ lead, onClose, onSaved }) {
  const isEdit = !!lead;
  const [form, setForm] = useState({
    company_name:'', contact_name:'', phone:'', email:'',
    industry:'', status:'new', next_call:'', source:'', notes:'',
  });
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isEdit) setForm(f => ({ ...f, ...lead, next_call: lead.next_call ? lead.next_call.slice(0,16) : '' }));
  }, []);
  const set = (k, v) => { setIsDirty(true); setForm(f => ({ ...f, [k]: v })); };
  const handleClose = () => {
    if (isDirty && !window.confirm('Закрыть без сохранения? Изменения будут потеряны.')) return;
    onClose();
  };

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await api.leads.update(lead.id, form);
      else await api.leads.create(form);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать лид' : 'Новый лид'}</div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Компания *</label>
            <input className="form-input" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Название компании" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Контактное лицо</label>
              <input className="form-input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-input form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Отрасль</label>
              <input className="form-input" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="Производство, ритейл…" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Следующий звонок</label>
              <input className="form-input" type="datetime-local" value={form.next_call} onChange={e => set('next_call', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Источник</label>
              <input className="form-input" value={form.source} onChange={e => set('source', e.target.value)} placeholder="Реклама, рекомендация…" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Примечания</label>
            <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ resize:'vertical' }} />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" className="btn-ghost" style={{ flex:1 }} onClick={handleClose}>Отмена</button>
            <button type="submit" className="btn-accent" disabled={saving}
              style={{ flex:2, justifyContent:'center', transition:'opacity .2s, box-shadow .2s',
                opacity: isDirty ? 1 : 0.55, boxShadow: isDirty ? '0 4px 16px rgba(19,102,240,0.45)' : 'none' }}>
              {saving ? 'Сохранение…' : isEdit ? 'Сохранить изменения' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoteModal({ lead, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [nextCall, setNextCall] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (text.trim() && !window.confirm('Закрыть без сохранения? Текст заметки будет потерян.')) return;
    onClose();
  };

  async function handleSave(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.leads.addCallNote(lead.id, text.trim());
      if (nextCall) await api.leads.update(lead.id, { next_call: nextCall });
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">Заметка по звонку</div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>
        <div style={{ fontSize:14, color:'#5A6573', marginBottom:20 }}>{lead.company_name} · {lead.contact_name}</div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Результат звонка *</label>
            <textarea className="form-input" value={text} onChange={e => setText(e.target.value)} placeholder="Что обсудили, договорились о…" rows={4} style={{ resize:'vertical' }} autoFocus required />
          </div>
          <div className="form-group">
            <label className="form-label">Следующий звонок</label>
            <input className="form-input" type="datetime-local" value={nextCall} onChange={e => setNextCall(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" className="btn-ghost" style={{ flex:1 }} onClick={handleClose}>Отмена</button>
            <button type="submit" className="btn-accent" disabled={saving}
              style={{ flex:2, justifyContent:'center', transition:'opacity .2s, box-shadow .2s',
                opacity: text.trim() ? 1 : 0.55, boxShadow: text.trim() ? '0 4px 16px rgba(19,102,240,0.45)' : 'none' }}>
              {saving ? 'Сохранение…' : 'Сохранить заметку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
