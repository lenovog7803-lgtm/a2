import React, { useState, useRef, useEffect } from 'react';
import { monthLabel } from '../api.js';

export default function TopBar({
  title, sub, period, periodOptions, onPeriodChange,
  searchValue, onSearchChange, searchResults, showSearch, onCloseSearch, onNavigate,
}) {
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (periodRef.current && !periodRef.current.contains(e.target)) setPeriodOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasSrOrders = searchResults?.orders?.length > 0;
  const hasSrClients = searchResults?.clients?.length > 0;
  const hasSrLeads = searchResults?.leads?.length > 0;
  const srEmpty = searchResults && !hasSrOrders && !hasSrClients && !hasSrLeads;

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {sub && <div className="topbar-sub">{sub}</div>}
      </div>
      <div className="topbar-spacer" />

      {/* Search */}
      <div className="topbar-search-wrap">
        <div className="topbar-search-input">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Поиск по заявкам, клиентам, лидам…"
          />
          {searchValue && (
            <button onClick={onCloseSearch} style={{ background:'none',border:'none',cursor:'pointer',color:'#8A93A0',display:'flex',alignItems:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        {showSearch && (
          <div className="topbar-search-dropdown">
            {hasSrOrders && (
              <>
                <div className="search-section-label">ЗАЯВКИ</div>
                {searchResults.orders.map(r => (
                  <div key={r.id} className="search-row" onClick={() => { onNavigate(`/orders/${r.id}`); onCloseSearch(); }}>
                    <span style={{ fontFamily:'JetBrains Mono', fontSize:13, fontWeight:600, color:'#1366F0' }}>{r.order_number}</span>
                    <span style={{ flex:1, fontSize:12.5, color:'#5A6573' }}>{r.client_name} · {r.route_from_address} → {r.route_to_address}</span>
                  </div>
                ))}
              </>
            )}
            {hasSrClients && (
              <>
                <div className="search-section-label">КЛИЕНТЫ</div>
                {searchResults.clients.map(r => (
                  <div key={r.id} className="search-row" onClick={() => { onNavigate(`/clients/${r.id}`); onCloseSearch(); }}>
                    <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#0E1726' }}>{r.name}</span>
                    <span style={{ fontSize:11.5, color:'#A6AEB8' }}>{r.phone}</span>
                  </div>
                ))}
              </>
            )}
            {hasSrLeads && (
              <>
                <div className="search-section-label">ЛИДЫ</div>
                {searchResults.leads.map(r => (
                  <div key={r.id} className="search-row" onClick={() => { onNavigate('/leads'); onCloseSearch(); }}>
                    <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#0E1726' }}>{r.company_name}</span>
                    <span style={{ fontSize:11.5, color:'#A6AEB8' }}>{r.status}</span>
                  </div>
                ))}
              </>
            )}
            {srEmpty && <div style={{ padding:'24px', textAlign:'center', fontSize:13, color:'#A6AEB8' }}>Ничего не найдено</div>}
          </div>
        )}
      </div>

      {/* Period picker */}
      <div className="topbar-period" ref={periodRef} onClick={() => setPeriodOpen(o => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A6573" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{monthLabel(period)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        {periodOpen && (
          <div className="period-dropdown" onClick={e => e.stopPropagation()}>
            {periodOptions.map(opt => (
              <React.Fragment key={opt.id}>
                <div
                  className={`period-option ${period === opt.id ? 'active' : ''}`}
                  onClick={() => { onPeriodChange(opt.id); setPeriodOpen(false); }}
                >
                  {opt.label}
                </div>
                {opt.divider && <div className="period-divider" />}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Bell */}
      <button className="topbar-bell-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5A6573" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span className="topbar-bell-dot" />
      </button>
    </header>
  );
}
