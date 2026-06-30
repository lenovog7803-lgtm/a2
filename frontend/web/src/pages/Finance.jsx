import React, { useState, useEffect, useCallback } from 'react';
import { api, fmtMoney, fmtShort } from '../api.js';
import { ProfitChart } from '../components/Chart.jsx';

const TABS = ['По заявкам', 'Поступления', 'Списания'];

export default function Finance({ period }) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [paymentsIn, setPaymentsIn] = useState([]);
  const [paymentsOut, setPaymentsOut] = useState([]);
  const [clients, setClients] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [showInModal, setShowInModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, cList, caList] = await Promise.all([
        api.dashboard(period),
        api.clients.list().catch(() => []),
        api.carriers.list().catch(() => []),
      ]);
      setDashData(d);
      setClients(cList);
      setCarriers(caList);
      const [pIn, pOut] = await Promise.all([
        api.paymentsIn.list({ month: period !== 'all' ? period : undefined }).catch(() => []),
        api.paymentsOut.list({ month: period !== 'all' ? period : undefined }).catch(() => []),
      ]);
      setPaymentsIn(pIn);
      setPaymentsOut(pOut);
    } catch {} finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const role = localStorage.getItem('user_role');
  if (role === 'manager') return <div className="empty-state" style={{ marginTop:80 }}>Нет доступа к финансам</div>;

  if (loading) return <div className="loader-wrap"><div className="loader" /></div>;

  const margin = Number(dashData?.total_margin ?? 0);
  const revenue = Number(dashData?.total_revenue ?? 0);
  const tax = margin * 0.2;
  const netProfit = margin * 0.8;
  const chartPoints = dashData?.chart_data || dashData?.profit_chart || [];

  const totalIn = paymentsIn.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOut = paymentsOut.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="page-content">
      {/* Summary band */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap:16 }}>
        <div className="hero-card">
          <div className="hero-card-orb" style={{ background:'radial-gradient(closest-side,rgba(91,232,155,0.32),transparent 70%)' }} />
          <div className="hero-card-content">
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', color:'rgba(255,255,255,0.55)' }}>ЧИСТАЯ ПРИБЫЛЬ (ПОСЛЕ НАЛОГА)</span>
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:38, color:'#fff', letterSpacing:'-1.2px', marginTop:12, lineHeight:1 }}>{fmtMoney(netProfit)} Br</div>
            <div style={{ display:'flex', gap:28, marginTop:22, paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.12)' }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Выручка</div>
                <div style={{ fontFamily:'JetBrains Mono', fontWeight:600, fontSize:17, color:'#fff', marginTop:4 }}>{fmtMoney(revenue)} Br</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>Резерв на налог (20%)</div>
                <div style={{ fontFamily:'JetBrains Mono', fontWeight:600, fontSize:17, color:'#5BE89B', marginTop:4 }}>{fmtMoney(tax)} Br</div>
              </div>
            </div>
          </div>
        </div>
        <div className="cashflow-income">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', color:'#1E7A47' }}>ПОСТУПИЛО</span>
            <div className="cashflow-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1E9E5A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </div>
          </div>
          <div>
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:25, color:'#13502F', letterSpacing:'-0.6px' }}>{fmtMoney(totalIn)} Br</div>
            <div style={{ fontSize:12, color:'#1E7A47', fontWeight:500, marginTop:5 }}>от клиентов за период</div>
          </div>
        </div>
        <div className="cashflow-payout">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', color:'#2A6299' }}>ВЫПЛАЧЕНО</span>
            <div className="cashflow-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3683C4" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
            </div>
          </div>
          <div>
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:25, color:'#15406B', letterSpacing:'-0.6px' }}>{fmtMoney(totalOut)} Br</div>
            <div style={{ fontSize:12, color:'#2A6299', fontWeight:500, marginTop:5 }}>перевозчикам за период</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="fin-tabs">
        {TABS.map((t, i) => <div key={i} className={`fin-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</div>)}
      </div>

      {tab === 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Metrics */}
          <div className="glass-card">
            <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726', marginBottom:16 }}>Финансовые показатели</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { label:'ВЫРУЧКА', val: revenue, color:'#0E1726' },
                { label:'МАРЖА', val: margin, color:'#1E9E5A' },
                { label:'НАЛОГ (20%)', val: tax, color:'#D97706' },
                { label:'ЧИСТАЯ ПРИБЫЛЬ', val: netProfit, color:'#1366F0' },
              ].map((m, i) => (
                <div key={i} style={{ background:'rgba(14,23,38,0.03)', borderRadius:14, padding:14 }}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:'1.4px', color:'#8A93A0', marginBottom:8 }}>{m.label}</div>
                  <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:16, color: m.color }}>{fmtMoney(m.val)} Br</div>
                </div>
              ))}
            </div>
          </div>
          {/* Chart */}
          <div className="glass-card">
            <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:16, color:'#0E1726', marginBottom:4 }}>Динамика</div>
            <div style={{ fontSize:12, color:'#8A93A0', marginBottom:14 }}>маржа по месяцам</div>
            <ProfitChart chartData={chartPoints} />
          </div>
        </div>
      )}

      {tab === 1 && (
        <PaymentsList
          payments={paymentsIn}
          clients={clients}
          title="Поступления от клиентов"
          colorScheme="green"
          onAdd={() => setShowInModal(true)}
          onRefresh={load}
          onDelete={async (id) => { await api.paymentsIn.remove(id); load(); }}
        />
      )}

      {tab === 2 && (
        <PaymentsList
          payments={paymentsOut}
          clients={carriers}
          title="Списания перевозчикам"
          colorScheme="purple"
          onAdd={() => setShowOutModal(true)}
          onRefresh={load}
          onDelete={async (id) => { await api.paymentsOut.remove(id); load(); }}
        />
      )}

      {showInModal && (
        <PaymentModal
          title="Добавить поступление"
          counterparties={clients}
          counterpartyLabel="Клиент"
          onClose={() => setShowInModal(false)}
          onSave={async (data) => { await api.paymentsIn.create(data); setShowInModal(false); load(); }}
        />
      )}
      {showOutModal && (
        <PaymentModal
          title="Добавить списание"
          counterparties={carriers}
          counterpartyLabel="Перевозчик"
          onClose={() => setShowOutModal(false)}
          onSave={async (data) => { await api.paymentsOut.create(data); setShowOutModal(false); load(); }}
        />
      )}
    </div>
  );
}

function PaymentsList({ payments, clients, title, colorScheme, onAdd, onDelete }) {
  const color = colorScheme === 'green' ? '#1E9E5A' : '#7C3AED';
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:'Onest', fontWeight:700, fontSize:18, color:'#0E1726' }}>{title}</div>
          <div style={{ fontSize:12.5, color:'#8A93A0', marginTop:2 }}>Итого: <span style={{ fontFamily:'JetBrains Mono', fontWeight:700, color }}>{fmtMoney(total)} Br</span></div>
        </div>
        <button className="btn-dark btn-sm" onClick={onAdd}>+ Добавить</button>
      </div>
      <div className="glass-card" style={{ padding:0, borderRadius:20, overflow:'hidden' }}>
        {payments.length === 0 && <div className="empty-state">Нет записей</div>}
        {payments.map((p, i) => (
          <div key={p.id || i} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 20px', borderBottom:'1px solid rgba(14,23,38,0.05)' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:600, color:'#0E1726' }}>{p.client_name || p.carrier_name || '—'}</div>
              {p.note && <div style={{ fontSize:12, color:'#8A93A0', marginTop:2 }}>{p.note}</div>}
              <div style={{ fontSize:11.5, color:'#A6AEB8', marginTop:2 }}>{p.date ? new Date(p.date).toLocaleDateString('ru-RU') : ''}</div>
            </div>
            <div style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:15, color }}>{fmtMoney(p.amount)} Br</div>
            <button onClick={() => onDelete(p.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#C4CAD2', padding:4 }}
              title="Удалить">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentModal({ title, counterparties, counterpartyLabel, onClose, onSave }) {
  const [form, setForm] = useState({ counterparty_name: '', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const set = (k, v) => { setIsDirty(true); setForm(f => ({ ...f, [k]: v })); };
  const handleClose = () => {
    if (isDirty && !window.confirm('Закрыть без сохранения? Изменения будут потеряны.')) return;
    onClose();
  };

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ ...form, amount: Number(form.amount) }); }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">{counterpartyLabel}</label>
            <input className="form-input" list="cp-list" value={form.counterparty_name} onChange={e => set('counterparty_name', e.target.value)} placeholder="Название" />
            <datalist id="cp-list">{counterparties.map(c => <option key={c.id} value={c.name || c.company_name} />)}</datalist>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Сумма (Br)</label>
              <input className="form-input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" required />
            </div>
            <div className="form-group">
              <label className="form-label">Дата</label>
              <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Примечание</label>
            <input className="form-input" value={form.note} onChange={e => set('note', e.target.value)} placeholder="Необязательно" />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" className="btn-ghost" style={{ flex:1 }} onClick={handleClose}>Отмена</button>
            <button type="submit" className="btn-accent" disabled={saving}
              style={{ flex:2, justifyContent:'center', transition:'opacity .2s, box-shadow .2s',
                opacity: isDirty ? 1 : 0.55, boxShadow: isDirty ? '0 4px 16px rgba(19,102,240,0.45)' : 'none' }}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
