import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtMoney, initials, avatarIdx, GRADIENTS, STATUS_LABELS, STATUS_COLORS } from '../api.js';
import { ClientModal } from './Clients.jsx';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, allOrders] = await Promise.all([
        api.clients.get(id),
        api.orders.list().catch(() => []),
      ]);
      setClient(c);
      setOrders(allOrders.filter(o => o.client_name === c.name));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="loader-wrap"><div className="loader" /></div>;
  if (!client) return <div className="empty-state">Клиент не найден</div>;

  const idx = avatarIdx(client.name || '');
  const [a, b] = GRADIENTS[idx];
  const rev = Number(client.total_revenue || 0);
  const totalDebt = orders.filter(o => !o.client_paid && o.status !== 'cancelled').reduce((s, o) => s + Number(o.client_rate || 0), 0);

  return (
    <div className="page-content">
      <button className="back-link" onClick={() => navigate('/clients')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        К списку клиентов
      </button>

      <div className="detail-grid">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Header */}
          <div className="hero-card">
            <div className="hero-card-orb" />
            <div className="hero-card-content">
              <div style={{ display:'flex', alignItems:'center', gap:16, justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <span style={{ width:56, height:56, borderRadius:16, background:`linear-gradient(145deg,${a},${b})`, color:'#fff', fontFamily:'Onest', fontWeight:800, fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {initials(client.name)}
                  </span>
                  <div>
                    <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:24, color:'#fff', letterSpacing:'-0.5px' }}>{client.name}</div>
                    {client.contact_person && <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginTop:4 }}>{client.contact_person}</div>}
                  </div>
                </div>
                <button className="btn-ghost btn-sm" style={{ color:'#fff', borderColor:'rgba(255,255,255,0.2)' }} onClick={() => setShowEdit(true)}>Изменить</button>
              </div>
              <div style={{ display:'flex', gap:28, marginTop:20, paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.12)' }}>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Выручка</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#fff', marginTop:4 }}>{fmtMoney(rev)} Br</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Заявок</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#fff', marginTop:4 }}>{orders.length}</div>
                </div>
                {totalDebt > 0 && (
                  <div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Долг</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#FFB366', marginTop:4 }}>{fmtMoney(totalDebt)} Br</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="glass-card" style={{ padding:0, borderRadius:22, overflow:'hidden' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(14,23,38,0.07)' }}>
              <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726' }}>История заявок</div>
            </div>
            {orders.length === 0 && <div className="empty-state">Заявок нет</div>}
            {orders.map(o => {
              const sc = STATUS_COLORS[o.status] || STATUS_COLORS.new;
              const margin = Number(o.margin ?? (Number(o.client_rate) - Number(o.carrier_rate)));
              return (
                <div key={o.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 22px', borderBottom:'1px solid rgba(14,23,38,0.05)', cursor:'pointer' }}
                  onClick={() => navigate(`/orders/${o.id}`)}>
                  <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#0E1726', flexShrink:0 }}>{o.order_number}</span>
                  <span className="status-badge" style={{ color: sc.color, background: sc.bg }}>{STATUS_LABELS[o.status]}</span>
                  <span style={{ flex:1, fontSize:13, color:'#5A6573', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {(o.load_address || '').split(',')[0]} → {(o.unload_address || '').split(',')[0]}
                  </span>
                  <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#1E9E5A', flexShrink:0 }}>{fmtMoney(margin)} Br</span>
                  <span className={`pay-pill ${o.client_paid ? 'paid' : 'unpaid'}`} style={{ flexShrink:0 }}>К</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: details */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
            <div className="label-caps">КОНТАКТЫ</div>
            {client.phone && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{client.phone}</div>}
            {client.email && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>{client.email}</div>}
            {client.city && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>{client.city}</div>}
            {client.address && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>{client.address}</div>}
          </div>
          {(client.inn || client.payment_terms) && (
            <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
              <div className="label-caps">РЕКВИЗИТЫ</div>
              {client.inn && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/></svg>УНП {client.inn}</div>}
              {client.payment_terms && <div className="info-row"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Оплата: {client.payment_terms}</div>}
            </div>
          )}
          {client.notes && (
            <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
              <div className="label-caps">ПРИМЕЧАНИЯ</div>
              <div style={{ fontSize:13.5, color:'#5A6573', lineHeight:1.6 }}>{client.notes}</div>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <ClientModal client={client} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />
      )}
    </div>
  );
}
