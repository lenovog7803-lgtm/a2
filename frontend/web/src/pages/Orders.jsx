import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtMoney, initials, avatarIdx, GRADIENTS, STATUS_LABELS, STATUS_COLORS } from '../api.js';
import OrderModal from './OrderModal.jsx';

const STATUSES = ['all', 'new', 'in_progress', 'delivered', 'cancelled'];
const STATUS_CHIP_LABELS = { all: 'Все', new: 'Новые', in_progress: 'В работе', delivered: 'Доставлено', cancelled: 'Отменено' };

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [payFilter, setPayFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders(await api.orders.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = orders.filter(o => {
    if (status !== 'all' && o.status !== status) return false;
    if (payFilter === 'client_unpaid' && o.client_paid) return false;
    if (payFilter === 'carrier_unpaid' && o.carrier_paid) return false;
    if (q && !`${o.order_number} ${o.client_name} ${o.load_address} ${o.unload_address}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = {};
  STATUSES.forEach(s => counts[s] = s === 'all' ? orders.length : orders.filter(o => o.status === s).length);

  return (
    <div className="page-content">
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div className="chip-row" style={{ flex:1 }}>
          {STATUSES.map(s => (
            <div key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {STATUS_CHIP_LABELS[s]}
              <span className="chip-count">{counts[s]}</span>
            </div>
          ))}
          <div className={`chip ${payFilter === 'client_unpaid' ? 'active' : ''}`} style={payFilter === 'client_unpaid' ? {} : { color:'#D97706', borderColor:'rgba(217,119,6,0.25)', background:'rgba(217,119,6,0.07)' }}
            onClick={() => setPayFilter(f => f === 'client_unpaid' ? 'all' : 'client_unpaid')}>
            Клиент не платил
          </div>
          <div className={`chip ${payFilter === 'carrier_unpaid' ? 'active' : ''}`} style={payFilter === 'carrier_unpaid' ? {} : { color:'#7C3AED', borderColor:'rgba(124,58,237,0.25)', background:'rgba(124,58,237,0.07)' }}
            onClick={() => setPayFilter(f => f === 'carrier_unpaid' ? 'all' : 'carrier_unpaid')}>
            Перевозчик не оплачен
          </div>
        </div>
        <button className="btn-dark" onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Новая заявка
        </button>
      </div>

      {/* Search */}
      <div className="inline-search" style={{ borderRadius:14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по заявкам, клиентам, маршруту…" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <div className="glass-card glass-card-table">
          <div className="orders-table-header">
            <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.1em', color:'#A6AEB8' }}>ЗАЯВКА</span>
            <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.1em', color:'#A6AEB8' }}>МАРШРУТ</span>
            <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.1em', color:'#A6AEB8' }}>КЛИЕНТ</span>
            <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.1em', color:'#A6AEB8', textAlign:'right' }}>МАРЖА</span>
            <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.1em', color:'#A6AEB8', textAlign:'center' }}>ОПЛАТЫ</span>
            <span />
          </div>
          {filtered.length === 0 && <div className="empty-state">Заявок нет</div>}
          {filtered.map(o => <OrderRow key={o.id} o={o} onClick={() => navigate(`/orders/${o.id}`)} />)}
        </div>
      )}

      {showModal && (
        <OrderModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}

function OrderRow({ o, onClick }) {
  const sc = STATUS_COLORS[o.status] || STATUS_COLORS.new;
  const sl = STATUS_LABELS[o.status] || o.status;
  const margin = Number(o.margin ?? 0);
  const cr = Number(o.client_rate ?? 0);
  const pct = cr > 0 ? ((margin / cr) * 100).toFixed(1) + '%' : '—';
  const idx = avatarIdx(o.client_name || '');
  const [a, b] = GRADIENTS[idx];

  const loadCity = (o.load_address || '').split(',')[0];
  const unloadCity = (o.unload_address || '').split(',')[0];
  const route = `${loadCity} → ${unloadCity}`;

  const loadDate = o.load_date ? new Date(o.load_date).toLocaleDateString('ru-RU', { day:'numeric', month:'short' }) : '';
  const unloadDate = o.unload_date ? new Date(o.unload_date).toLocaleDateString('ru-RU', { day:'numeric', month:'short' }) : '';
  const dateRange = [loadDate, unloadDate].filter(Boolean).join(' – ');

  return (
    <div className="orders-table-row" onClick={onClick}>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#0E1726' }}>{o.order_number}</span>
        <span className="status-badge" style={{ color: sc.color, background: sc.bg }}>{sl}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>
        <span style={{ fontSize:13.5, fontWeight:600, color:'#0E1726', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{route}</span>
        <span style={{ fontSize:11.5, color:'#8A93A0' }}>{dateRange}{o.weight ? ` · ${o.weight} т` : ''}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
        <span style={{ flexShrink:0, width:30, height:30, borderRadius:9, background:`linear-gradient(145deg,${a},${b})`, color:'#fff', fontFamily:'Onest', fontWeight:700, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {initials(o.client_name || '')}
        </span>
        <span style={{ fontSize:12.5, color:'#5A6573', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.client_name}</span>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontFamily:'JetBrains Mono', fontSize:14, fontWeight:700, color:'#1E9E5A' }}>{fmtMoney(margin)} Br</div>
        <div style={{ fontFamily:'JetBrains Mono', fontSize:11, color:'#A6AEB8' }}>{pct}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
        <span className={`pay-pill ${o.client_paid ? 'paid' : 'unpaid'}`}>К</span>
        <span className={`pay-pill ${o.carrier_paid ? 'paid' : 'unpaid'}`}>П</span>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C4CAD2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}
