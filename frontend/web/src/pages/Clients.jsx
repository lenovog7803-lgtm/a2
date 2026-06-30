import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtMoney, initials, avatarIdx, GRADIENTS } from '../api.js';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try { setClients(await api.clients.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c => [c.name, c.contact_person, c.phone, c.city].some(f => (f || '').toLowerCase().includes(q)))
    : clients;

  return (
    <div className="page-content">
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div className="inline-search" style={{ flex:1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по клиентам…" />
        </div>
        <button className="btn-dark" onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить клиента
        </button>
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <div className="clients-grid">
          {filtered.length === 0 && <div className="empty-state" style={{ gridColumn:'1/-1' }}>Нет клиентов</div>}
          {filtered.map(c => <ClientCard key={c.id} client={c} onClick={() => navigate(`/clients/${c.id}`)} />)}
        </div>
      )}

      {showModal && <ClientModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function ClientCard({ client, onClick }) {
  const idx = avatarIdx(client.name || '');
  const [a, b] = GRADIENTS[idx];
  const rev = Number(client.total_revenue || 0);
  const revFmt = rev >= 1000000 ? (rev/1000000).toFixed(1)+'M' : rev >= 1000 ? (rev/1000).toFixed(0)+'K' : rev > 0 ? String(Math.round(rev)) : '—';

  return (
    <div className="client-card" onClick={onClick}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <span style={{ width:46, height:46, borderRadius:14, background:`linear-gradient(145deg,${a},${b})`, color:'#fff', fontFamily:'Onest', fontWeight:700, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 6px 16px -6px ${b}66` }}>
          {initials(client.name || '')}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14.5, fontWeight:700, color:'#0E1726', letterSpacing:'-0.3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{client.name}</div>
          <div style={{ fontSize:12, color:'#8A93A0', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{client.contact_person || client.phone || '—'}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ flex:1, borderRadius:13, padding:11, background:'rgba(14,23,38,0.035)' }}>
          <div style={{ fontSize:10.5, color:'#8A93A0', marginBottom:4 }}>Выручка</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#0E1726', fontFamily:'JetBrains Mono' }}>{revFmt} Br</div>
        </div>
        <div style={{ flex:1, borderRadius:13, padding:11, background:'rgba(14,23,38,0.035)' }}>
          <div style={{ fontSize:10.5, color:'#8A93A0', marginBottom:4 }}>Заявок</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#0E1726', fontFamily:'JetBrains Mono' }}>{client.orders_count || 0}</div>
        </div>
      </div>
      {(client.inn || client.city) && (
        <div style={{ fontSize:11.5, color:'#5A6573', marginTop:12 }}>
          {[client.inn && `УНП ${client.inn}`, client.city].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}

function ClientModal({ client, onClose, onSaved }) {
  const isEdit = !!client;
  const [form, setForm] = useState({ name:'', contact_person:'', phone:'', email:'', inn:'', city:'', address:'', payment_terms:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => { if (isEdit) setForm(f => ({ ...f, ...client })); }, []);
  const set = (k, v) => { setIsDirty(true); setForm(f => ({ ...f, [k]: v })); };
  const handleClose = () => {
    if (isDirty && !window.confirm('Закрыть без сохранения? Изменения будут потеряны.')) return;
    onClose();
  };

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await api.clients.update(client.id, form);
      else await api.clients.create(form);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать клиента' : 'Новый клиент'}</div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Название *</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="ООО «Компания»" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Контактное лицо</label>
              <input className="form-input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="ФИО" />
            </div>
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+375 XX XXX XX XX" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">УНП/ИНН</label>
              <input className="form-input" value={form.inn} onChange={e => set('inn', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Город</label>
              <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Условия оплаты</label>
              <input className="form-input" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="30 дней" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Адрес</label>
            <input className="form-input" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Примечания</label>
            <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ resize:'vertical' }} />
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

export { ClientModal };
