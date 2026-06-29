import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtMoney, initials, STATUS_LABELS, STATUS_COLORS } from '../api.js';
import OrderModal from './OrderModal.jsx';

const STATUSES = ['new', 'in_progress', 'delivered', 'cancelled'];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setOrder(await api.orders.get(id)); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const togglePaid = async (field) => {
    setSaving(true);
    try {
      const updated = await api.orders.update(id, { [field]: !order[field] });
      setOrder(updated);
    } catch {} finally { setSaving(false); }
  };

  const changeStatus = async (s) => {
    setSaving(true);
    try {
      const updated = await api.orders.update(id, { status: s });
      setOrder(updated);
    } catch {} finally { setSaving(false); }
  };

  const generateDoc = async (kind) => {
    try {
      const r = await api.orders.generateDoc(id, kind);
      if (r.url) window.open(r.url, '_blank');
    } catch (e) { alert('Ошибка генерации: ' + e.message); }
  };

  if (loading) return <div className="loader-wrap"><div className="loader" /></div>;
  if (!order) return <div className="empty-state">Заявка не найдена</div>;

  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.new;
  const sl = STATUS_LABELS[order.status] || order.status;
  const margin = Number(order.margin ?? (Number(order.client_rate) - Number(order.carrier_rate)));
  const cr = Number(order.client_rate ?? 0);
  const pct = cr > 0 ? ((margin / cr) * 100).toFixed(1) + '%' : '—';
  const loadCity = (order.load_address || '').split(',')[0];
  const unloadCity = (order.unload_address || '').split(',')[0];
  const route = `${loadCity} — ${unloadCity}`;
  const loadDateFmt = order.load_date ? new Date(order.load_date).toLocaleDateString('ru-RU', { day:'numeric', month:'long' }) : '—';
  const unloadDateFmt = order.unload_date ? new Date(order.unload_date).toLocaleDateString('ru-RU', { day:'numeric', month:'long' }) : '—';

  const googleDocs = [
    order.doc_client_url && { label: 'Акт клиента', color: '#1366F0', bg: 'rgba(19,102,240,0.08)', url: order.doc_client_url },
    order.doc_carrier_url && { label: 'Акт перевозчика', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', url: order.doc_carrier_url },
    order.doc_act_url && { label: 'Сверочный акт', color: '#1E9E5A', bg: 'rgba(30,158,90,0.08)', url: order.doc_act_url },
  ].filter(Boolean);

  return (
    <div className="page-content">
      <button className="back-link" onClick={() => navigate('/orders')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        К списку заявок
      </button>

      <div className="detail-grid">
        {/* LEFT */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Header card */}
          <div className="hero-card">
            <div className="hero-card-orb" style={{ background:'radial-gradient(closest-side,rgba(91,232,155,0.22),transparent 70%)' }} />
            <div className="hero-card-content">
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
                <div>
                  <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.6)' }}>{order.order_number}</span>
                  <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:24, color:'#fff', marginTop:6, letterSpacing:'-0.5px' }}>{route}</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginTop:6 }}>
                    {order.cargo}{order.weight ? ` · ${order.weight} т` : ''} · {loadDateFmt}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <span className="status-badge" style={{ color: sc.color, background: sc.bg, fontSize:12.5, padding:'6px 13px', borderRadius:10 }}>{sl}</span>
                  <button className="btn-ghost btn-sm" style={{ color:'#fff', borderColor:'rgba(255,255,255,0.2)' }} onClick={() => setShowEdit(true)}>Изменить</button>
                </div>
              </div>
              <div style={{ display:'flex', gap:28, marginTop:22, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.12)' }}>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Ставка клиента</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#fff', marginTop:4 }}>{fmtMoney(order.client_rate)} Br</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Ставка перевозчика</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#fff', marginTop:4 }}>{fmtMoney(order.carrier_rate)} Br</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Маржа · {pct}</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:19, color:'#5BE89B', marginTop:4 }}>{fmtMoney(margin)} Br</div>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
            <div className="label-caps">СТАТУС ЗАЯВКИ</div>
            <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
              {STATUSES.map(s => {
                const c = STATUS_COLORS[s];
                const active = order.status === s;
                return (
                  <div key={s} onClick={() => changeStatus(s)} style={{
                    padding:'8px 16px', borderRadius:11, cursor:'pointer', fontSize:13, fontWeight:600,
                    border:`1.5px solid ${active ? c.color : 'rgba(14,23,38,0.08)'}`,
                    background: active ? c.bg : 'rgba(255,255,255,0.6)',
                    color: active ? c.color : '#5A6573',
                    transition:'all .14s',
                  }}>
                    {STATUS_LABELS[s]}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payments */}
          <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
            <div className="label-caps">ОПЛАТЫ</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className={`pay-toggle ${order.client_paid ? 'paid' : 'unpaid'}`} onClick={() => togglePaid('client_paid')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={order.client_paid ? '#1E9E5A' : '#A6AEB8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#0E1726' }}>{order.client_paid ? 'Клиент оплатил' : 'Клиент не оплатил'}</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontSize:12, color:'#8A93A0' }}>{fmtMoney(order.client_rate)} Br</div>
                </div>
              </div>
              <div className={`pay-toggle ${order.carrier_paid ? 'paid' : 'unpaid'}`} onClick={() => togglePaid('carrier_paid')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={order.carrier_paid ? '#7C3AED' : '#A6AEB8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#0E1726' }}>{order.carrier_paid ? 'Перевозчик оплачен' : 'Перевозчик не оплачен'}</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontSize:12, color:'#8A93A0' }}>{fmtMoney(order.carrier_rate)} Br</div>
                </div>
              </div>
            </div>
          </div>

          {/* Route & vehicle */}
          <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
            <div className="label-caps">МАРШРУТ И ТРАНСПОРТ</div>
            <div style={{ display:'flex', gap:13 }}>
              <div className="route-line">
                <span className="route-dot-green" />
                <span className="route-dash-line" />
                <span className="route-dot-red" />
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between', gap:14 }}>
                <div>
                  <div style={{ fontSize:11, color:'#8A93A0', fontWeight:500 }}>Загрузка · {loadDateFmt}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#0E1726', marginTop:2 }}>{order.load_address || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'#8A93A0', fontWeight:500 }}>Выгрузка · {unloadDateFmt}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#0E1726', marginTop:2 }}>{order.unload_address || '—'}</div>
                </div>
              </div>
            </div>
            {(order.driver_name || order.plate) && (
              <div style={{ display:'flex', alignItems:'center', gap:11, marginTop:16, paddingTop:15, borderTop:'1px solid rgba(14,23,38,0.07)' }}>
                <div style={{ width:38, height:38, borderRadius:11, background:'rgba(14,23,38,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5A6573" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
                    <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
                  </svg>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#0E1726' }}>{order.driver_name || '—'}</div>
                  <div style={{ fontSize:12, color:'#8A93A0' }}>{[order.vehicle_type, order.plate, order.driver_phone].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            )}
          </div>

          {/* Google Docs */}
          <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
            <div className="label-caps">GOOGLE DOCS</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { kind:'client', label:'Акт клиента', color:'#1366F0', bg:'rgba(19,102,240,0.08)', url: order.doc_client_url },
                { kind:'carrier', label:'Акт перевозчика', color:'#7C3AED', bg:'rgba(124,58,237,0.08)', url: order.doc_carrier_url },
                { kind:'act', label:'Сверочный акт', color:'#1E9E5A', bg:'rgba(30,158,90,0.08)', url: order.doc_act_url },
              ].map(d => (
                <div key={d.kind} style={{ display:'flex', alignItems:'center', gap:13, padding:'13px 15px', borderRadius:14, background:'#fff', border:'1px solid rgba(14,23,38,0.07)', cursor:'pointer' }}
                  onClick={() => d.url ? window.open(d.url, '_blank') : generateDoc(d.kind)}>
                  <div style={{ width:40, height:40, borderRadius:11, background:d.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={d.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Onest', fontSize:15, fontWeight:700, color:'#0E1726' }}>{d.label}</div>
                    <div style={{ fontSize:12.5, fontWeight:600, color: d.url ? d.color : '#A6AEB8', marginTop:1 }}>{d.url ? 'Готов · открыть' : 'Нажмите для создания'}</div>
                  </div>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
              <div className="label-caps">ПРИМЕЧАНИЯ</div>
              <div style={{ fontSize:14, color:'#5A6573', lineHeight:1.6 }}>{order.notes}</div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Client */}
          {order.client_name && (
            <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
              <div className="label-caps">КЛИЕНТ</div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ width:44, height:44, borderRadius:13, background:'linear-gradient(145deg,#A5D8FF,#1366F0)', color:'#fff', fontFamily:'Onest', fontWeight:700, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {initials(order.client_name)}
                </span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:600, color:'#0E1726' }}>{order.client_name}</div>
                  {order.client_contact && <div style={{ fontSize:12, color:'#8A93A0' }}>{order.client_contact}</div>}
                </div>
              </div>
              {order.client_phone && (
                <div className="info-row" style={{ marginTop:16 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  {order.client_phone}
                </div>
              )}
            </div>
          )}

          {/* Carrier */}
          {order.carrier_name && (
            <div className="glass-card" style={{ padding:'20px 22px', borderRadius:22 }}>
              <div className="label-caps">ПЕРЕВОЗЧИК</div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ width:44, height:44, borderRadius:13, background:'linear-gradient(145deg,#D0BFFF,#7C3AED)', color:'#fff', fontFamily:'Onest', fontWeight:700, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {initials(order.carrier_name)}
                </span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:600, color:'#0E1726' }}>{order.carrier_name}</div>
                  {order.driver_name && <div style={{ fontSize:12, color:'#8A93A0' }}>{order.driver_name}</div>}
                </div>
              </div>
              {order.driver_phone && (
                <div className="info-row" style={{ marginTop:16 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  {order.driver_phone}
                </div>
              )}
              {order.plate && (
                <div className="info-row">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="18" height="12" rx="2"/>
                  </svg>
                  <span style={{ fontFamily:'JetBrains Mono' }}>{order.plate}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <OrderModal order={order} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />
      )}
    </div>
  );
}
