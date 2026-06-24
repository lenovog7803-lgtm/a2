import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtMoney, initials, avatarIdx, GRADIENTS, STATUS_LABELS, STATUS_COLORS } from '../api.js';
import { CarrierModal } from './Carriers.jsx';

export default function CarrierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [carrier, setCarrier] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, allOrders] = await Promise.all([
        api.carriers.get(id),
        api.orders.list().catch(() => []),
      ]);
      setCarrier(c);
      setOrders(allOrders.filter(o => o.carrier_name === c.company_name));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="loader-wrap"><div className="loader" /></div>;
  if (!carrier) return <div className="empty-state">Перевозчик не найден</div>;

  const idx = avatarIdx(carrier.company_name || '');
  const [a, b] = GRADIENTS[idx];
  const totalPaid = orders.filter(o => o.carrier_paid).reduce((s, o) => s + Number(o.carrier_rate || 0), 0);
  const totalDebt = orders.filter(o => !o.carrier_paid && o.status !== 'cancelled').reduce((s, o) => s + Number(o.carrier_rate || 0), 0);

  return (
    <div className="page-content">
      <button className="back-link" onClick={() => navigate('/carriers')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        К списку перевозчиков
      </button>

      <div className="detail-grid">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="hero-card">
            <div className="hero-card-orb" style={{ background:`radial-gradient(closest-side,rgba(124,58,237,0.3),transparent 70%)` }} />
            <div className="hero-card-content">
              <div style={{ display:'flex', alignItems:'center', gap:16, justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <span style={{ width:56, height:56, borderRadius:16, background:`linear-gradient(145deg,${a},${b})`, color:'#fff', fontFamily:'Onest', fontWeight:800, fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {initials(carrier.company_name || '')}
                  </span>
                  <div>
                    <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:24, color:'#fff', letterSpacing:'-0.5px' }}>{carrier.company_name}</div>
                    {carrier.driver_name && <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginTop:4 }}>{carrier.driver_name}</div>}
                  </div>
                </div>
                <button className="btn-ghost btn-sm" style={{ color:'#fff', borderColor:'rgba(255,255,255,0.2)' }} onClick={() => setShowEdit(true)}>Изменить</button>
              </div>
              <div style={{ display:'flex', gap:28, marginTop:20, paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.12)' }}>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Заявок</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#fff', marginTop:4 }}>{orders.length}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Оплачено</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#5BE89B', marginTop:4 }}>{fmtMoney(totalPaid)} Br</div>
                </div>
                {totalDebt > 0 && (
                  <div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>К выплате</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#FFB366', marginTop:4 }}>{fmtMoney(totalDebt)} Br</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding:0, borderRadius:22, overflow:'hidden' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(14,23,38,0.07)' }}>
              <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726' }}>История перевозок</div>
            </div>
            {orders.length === 0 && <div className="empty-state">Перевозок нет</div>}
            {orders.map(o => {
              const sc = STATUS_COLORS[o.status] || STATUS_COLORS.new;
              return (
                <div key={o.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 22px', borderBottom:'1px solid rgba(14,23,38,0.05)', cursor:'pointer' }}
                  onClick={() => navigate(`/orders/${o.id}`)}>
                  <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#0E1726', flexShrink:0 }}>{o.number}</span>
                  <span className="status-badge" style={{ color: sc.color, background: sc.bg }}>{STATUS_LABELS[o.status]}</span>
                  <span style={{ flex:1, fontSize:13, color:'#5A6573', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {(o.load_address || '').split(',')[0]} → {(o.unload_address || '').split(',')[0]}
                  </span>
                  <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#7C3AED', flexShrink:0 }}>{fmtMoney(o.carrier_rate)} Br</span>
                  <span className={`pay-pill ${o.carrier_paid ? 'paid' : 'unpaid'}`} style={{ flexShrink:0 }}>П</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
            <div className="label-caps">КОНТАКТЫ</div>
            {carrier.phone && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{carrier.phone}</div>}
            {carrier.email && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>{carrier.email}</div>}
          </div>
          <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
            <div className="label-caps">ТРАНСПОРТ</div>
            {carrier.vehicle_type && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>{carrier.vehicle_type}</div>}
            {carrier.plate && <div className="info-row" style={{ fontFamily:'JetBrains Mono' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>{carrier.plate}</div>}
            {carrier.capacity && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>{carrier.capacity}</div>}
            {carrier.rating && <div className="info-row">★ Рейтинг: <strong>{Number(carrier.rating).toFixed(1)}</strong></div>}
          </div>
          {carrier.notes && (
            <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
              <div className="label-caps">ПРИМЕЧАНИЯ</div>
              <div style={{ fontSize:13.5, color:'#5A6573', lineHeight:1.6 }}>{carrier.notes}</div>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <CarrierModal carrier={carrier} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />
      )}
    </div>
  );
}
