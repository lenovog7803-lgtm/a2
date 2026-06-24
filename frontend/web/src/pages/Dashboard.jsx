import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtMoney, fmtShort, initials, GRADIENTS, avatarIdx } from '../api.js';
import { ProfitChart } from '../components/Chart.jsx';

export default function Dashboard({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.dashboard(period);
      setData(d);
    } catch {}
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loader-wrap"><div className="loader" /></div>;
  if (!data) return <div className="empty-state">Не удалось загрузить данные</div>;

  const margin = Number(data.total_margin ?? 0);
  const revenue = Number(data.total_revenue ?? 0);
  const profit = margin * 0.8;
  const clientDebt = Number(data.client_debt ?? 0);
  const carrierDebt = Number(data.carrier_debt ?? 0);
  const activeOrders = data.active_orders ?? 0;
  const doneOrders = data.done_orders ?? 0;
  const clientsCount = data.clients_count ?? 0;
  const carriersCount = data.carriers_count ?? 0;
  const topClients = (data.top_clients || []).slice(0, 6);
  const topByMargin = (data.top_by_margin || []).slice(0, 6);
  const clientDebtors = (data.client_debtors || []).slice(0, 5);
  const chartPoints = data.chart_data || data.profit_chart || [];

  const prevMarginChange = data.margin_change;
  const changePos = prevMarginChange > 0;

  return (
    <div className="page-content">
      {/* Hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: 16 }}>
        {/* Hero margin */}
        <div className="hero-card">
          <div className="hero-card-orb" />
          <div className="hero-card-content">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'rgba(255,255,255,0.55)' }}>МАРЖА ЗА ПЕРИОД</span>
              {prevMarginChange !== undefined && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, background: changePos ? 'rgba(52,210,123,0.18)' : 'rgba(224,71,59,0.18)', color: changePos ? '#5BE89B' : '#FF8A8A', fontSize:12, fontWeight:700, padding:'4px 9px', borderRadius:9 }}>
                  {changePos ? '▲' : '▼'} {Math.abs(prevMarginChange)}%
                </span>
              )}
            </div>
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:42, color:'#fff', letterSpacing:'-1.5px', marginTop:14, lineHeight:1 }}>
              {fmtMoney(margin)} Br
            </div>
            <div style={{ height:1, background:'rgba(255,255,255,0.12)', margin:'20px 0' }} />
            <div style={{ display:'flex', gap:28 }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:500 }}>Выручка</div>
                <div style={{ fontFamily:'JetBrains Mono', fontWeight:600, fontSize:18, color:'#fff', marginTop:4 }}>{fmtMoney(revenue)} Br</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:500 }}>Прибыль (–20%)</div>
                <div style={{ fontFamily:'JetBrains Mono', fontWeight:600, fontSize:18, color:'#5BE89B', marginTop:4 }}>{fmtMoney(profit)} Br</div>
              </div>
            </div>
          </div>
        </div>

        {/* Client debt */}
        <div className="cashflow-client">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', color:'#A86A20' }}>ОЖИДАЕТСЯ ОТ КЛИЕНТОВ</span>
            <div className="cashflow-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
          </div>
          <div>
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:27, color:'#7A4A12', letterSpacing:'-0.8px' }}>{fmtMoney(clientDebt)} Br</div>
            <div style={{ fontSize:12, color:'#A86A20', fontWeight:500, marginTop:5 }}>{data.client_debtors_count ?? clientDebtors.length} клиентов · к получению</div>
          </div>
        </div>

        {/* Carrier debt */}
        <div className="cashflow-carrier">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', color:'#6B3FB8' }}>К ОПЛАТЕ ПЕРЕВОЗЧИКАМ</span>
            <div className="cashflow-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
                <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
              </svg>
            </div>
          </div>
          <div>
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:27, color:'#4A2785', letterSpacing:'-0.8px' }}>{fmtMoney(carrierDebt)} Br</div>
            <div style={{ fontSize:12, color:'#6B3FB8', fontWeight:500, marginTop:5 }}>к выплате</div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid">
        {[
          { val: activeOrders, label: 'Активных заявок', color: '#D97706' },
          { val: doneOrders, label: 'Доставлено', color: '#1E9E5A' },
          { val: clientsCount, label: 'Клиентов', color: '#1366F0' },
          { val: carriersCount, label: 'Перевозчиков', color: '#7C3AED' },
        ].map((kpi, i) => (
          <div key={i} className="glass-card kpi-card">
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:26, color: kpi.color }}>{kpi.val}</div>
            <div style={{ fontSize:12.5, color:'#8A93A0', fontWeight:500, marginTop:3 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Chart + Top clients */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16 }}>
        <div className="glass-card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <div>
              <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726' }}>Динамика прибыли</div>
              <div style={{ fontSize:12, color:'#8A93A0', marginTop:2 }}>по месяцам · Br</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:18, margin:'4px 0 14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ width:18, height:3, borderRadius:2, background:'linear-gradient(90deg,#1366F0,#0E1726)', display:'inline-block' }} />
              <span style={{ fontSize:11.5, color:'#5A6573', fontWeight:600 }}>Текущий</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ width:18, display:'inline-block', borderTop:'2px dashed #B8C0CC' }} />
              <span style={{ fontSize:11.5, color:'#A6AEB8', fontWeight:600 }}>Предыдущий</span>
            </div>
          </div>
          <ProfitChart chartData={chartPoints} />
        </div>

        <div className="glass-card">
          <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726' }}>Топ клиентов</div>
          <div style={{ fontSize:12, color:'#8A93A0', marginTop:2, marginBottom:14 }}>по выручке за период</div>
          {topClients.length === 0 && <div className="empty-state" style={{ padding:'24px 0' }}>Нет данных</div>}
          {topClients.map((c, i) => (
            <div key={i} className="top-list-row" style={{ cursor:'pointer' }} onClick={() => c.id && navigate(`/clients/${c.id}`)}>
              <span className="top-rank rank-blue">{i + 1}</span>
              <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#0E1726', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
              <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#0E1726' }}>{fmtMoney(c.revenue)} Br</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top margin + Debtors */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="glass-card">
          <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726' }}>Топ по марже</div>
          <div style={{ fontSize:12, color:'#8A93A0', marginTop:2, marginBottom:14 }}>% маржинальности</div>
          {topByMargin.length === 0 && <div className="empty-state" style={{ padding:'24px 0' }}>Нет данных</div>}
          {topByMargin.map((c, i) => {
            const pct = c.margin_pct ?? c.pct ?? 0;
            return (
              <div key={i} className="top-list-row">
                <span className="top-rank rank-green">{i + 1}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#0E1726', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#1E9E5A' }}>{Number(pct).toFixed(1)}%</span>
              </div>
            );
          })}
        </div>

        <div className="glass-card">
          <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726' }}>Должники — клиенты</div>
          <div style={{ fontSize:12, color:'#8A93A0', marginTop:2, marginBottom:14 }}>неоплаченные доставки</div>
          {clientDebtors.length === 0 && <div className="empty-state" style={{ padding:'24px 0' }}>Нет должников</div>}
          {clientDebtors.map((c, i) => (
            <div key={i} className="top-list-row">
              <span style={{ width:30, height:30, borderRadius:9, background:'rgba(217,119,6,0.12)', color:'#D97706', fontFamily:'Onest', fontWeight:700, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {initials(c.name)}
              </span>
              <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#0E1726', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
              <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:700, color:'#D97706' }}>{fmtMoney(c.debt ?? c.amount)} Br</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
