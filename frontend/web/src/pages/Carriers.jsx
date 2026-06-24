import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtMoney, initials, avatarIdx, GRADIENTS } from '../api.js';

export default function Carriers() {
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try { setCarriers(await api.carriers.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? carriers.filter(c => [c.company_name, c.driver_name, c.phone, c.plate].some(f => (f || '').toLowerCase().includes(q)))
    : carriers;

  return (
    <div className="page-content">
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div className="inline-search" style={{ flex:1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по перевозчикам…" />
        </div>
        <button className="btn-dark" onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить перевозчика
        </button>
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <div className="clients-grid">
          {filtered.length === 0 && <div className="empty-state" style={{ gridColumn:'1/-1' }}>Нет перевозчиков</div>}
          {filtered.map(c => <CarrierCard key={c.id} carrier={c} onClick={() => navigate(`/carriers/${c.id}`)} />)}
        </div>
      )}

      {showModal && <CarrierModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function CarrierCard({ carrier, onClick }) {
  const idx = avatarIdx(carrier.company_name || '');
  const [a, b] = GRADIENTS[idx];
  const rating = carrier.rating ? Number(carrier.rating).toFixed(1) : null;

  return (
    <div className="client-card" onClick={onClick}>
      <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:14 }}>
        <span style={{ width:46, height:46, borderRadius:14, background:`linear-gradient(145deg,${a},${b})`, color:'#fff', fontFamily:'Onest', fontWeight:700, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {initials(carrier.company_name || '')}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#0E1726', letterSpacing:'-0.3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{carrier.company_name}</div>
          <div style={{ fontSize:11.5, color:'#8A93A0', marginTop:2 }}>{carrier.driver_name || '—'}</div>
        </div>
        {rating && (
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(217,119,6,0.1)', padding:'4px 8px', borderRadius:9, flexShrink:0 }}>
            <span style={{ fontSize:10 }}>★</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#A86A20' }}>{rating}</span>
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
        {carrier.vehicle_type && <span style={{ borderRadius:10, padding:'6px 10px', background:'rgba(14,23,38,0.05)', fontSize:12, fontWeight:600, color:'#0E1726' }}>{carrier.vehicle_type}</span>}
        {carrier.plate && <span style={{ borderRadius:10, padding:'6px 10px', background:'rgba(14,23,38,0.05)', fontSize:12, fontWeight:600, color:'#0E1726', fontFamily:'JetBrains Mono' }}>{carrier.plate}</span>}
      </div>
      {carrier.phone && <div style={{ fontSize:12, color:'#5A6573', marginTop:12 }}>{carrier.phone}</div>}
    </div>
  );
}

function CarrierModal({ carrier, onClose, onSaved }) {
  const isEdit = !!carrier;
  const [form, setForm] = useState({ company_name:'', driver_name:'', phone:'', email:'', plate:'', vehicle_type:'', capacity:'', rating:'', notes:'' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isEdit) setForm(f => ({ ...f, ...carrier })); }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await api.carriers.update(carrier.id, form);
      else await api.carriers.create(form);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать перевозчика' : 'Новый перевозчик'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Название компании *</label>
            <input className="form-input" value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="ИП Иванов" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Водитель</label>
              <input className="form-input" value={form.driver_name} onChange={e => set('driver_name', e.target.value)} placeholder="ФИО" />
            </div>
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Госномер</label>
              <input className="form-input" value={form.plate} onChange={e => set('plate', e.target.value)} placeholder="А 000 АА" style={{ fontFamily:'JetBrains Mono' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Тип ТС</label>
              <input className="form-input" value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)} placeholder="Тент, рефрижератор…" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Грузоподъёмность</label>
              <input className="form-input" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="20 т" />
            </div>
            <div className="form-group">
              <label className="form-label">Рейтинг (1–5)</label>
              <input className="form-input" type="number" min="1" max="5" step="0.1" value={form.rating} onChange={e => set('rating', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Примечания</label>
            <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ resize:'vertical' }} />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" className="btn-ghost" style={{ flex:1 }} onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-accent" style={{ flex:2, justifyContent:'center' }} disabled={saving}>{saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { CarrierModal };
