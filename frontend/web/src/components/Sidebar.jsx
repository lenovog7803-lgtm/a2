import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { initials } from '../api.js';

const NAV_ITEMS = [
  { label: 'Дашборд', path: '/', icon: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  )},
  { label: 'Заявки', path: '/orders', icon: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18M3 12h18M3 17h12"/>
    </svg>
  )},
  { label: 'Финансы', path: '/finance', icon: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { label: 'Задачи', path: '/tasks', icon: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )},
  { label: 'Клиенты', path: '/clients', icon: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    </svg>
  )},
  { label: 'Перевозчики', path: '/carriers', icon: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  )},
  { label: 'База обзвона', path: '/leads', icon: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )},
];

export default function Sidebar({ expanded, onToggle, userData, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const userInitials = initials(userData?.name || 'А2');

  return (
    <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo" onClick={onToggle}>А2</div>
        {expanded && (
          <>
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">А2 Group</div>
              <div className="sidebar-brand-sub">ГРУЗОПЕРЕВОЗКИ</div>
            </div>
            <button className="sidebar-collapse-btn" onClick={onToggle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {expanded && <div className="sidebar-section-label">МЕНЮ</div>}

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <div
            key={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={!expanded ? item.label : undefined}
          >
            {item.icon}
            {expanded && <span className="nav-item-label">{item.label}</span>}
          </div>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-user">
        <div className="sidebar-avatar">{userInitials}</div>
        {expanded && (
          <>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userData?.name || 'Пользователь'}</div>
              <div className="sidebar-user-role">{userData?.role === 'admin' ? 'Администратор' : userData?.role === 'director' ? 'Директор' : 'Менеджер'}</div>
            </div>
            <button className="sidebar-logout-btn" onClick={onLogout} title="Выйти">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
