import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Finance from './pages/Finance.jsx';
import Tasks from './pages/Tasks.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import Carriers from './pages/Carriers.jsx';
import CarrierDetail from './pages/CarrierDetail.jsx';
import Leads from './pages/Leads.jsx';
import Login from './pages/Login.jsx';
import { api, monthLabel, currentMonth } from './api.js';

function RequireAuth({ children }) {
  const token = localStorage.getItem('jwt_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

const PERIOD_OPTIONS = [
  { id: 'all', label: 'Все время', divider: true },
  { id: '2026-06', label: 'Июнь 2026' },
  { id: '2026-05', label: 'Май 2026' },
  { id: '2026-04', label: 'Апр 2026' },
  { id: '2026-03', label: 'Мар 2026' },
  { id: '2026-02', label: 'Фев 2026' },
  { id: '2026-01', label: 'Янв 2026', divider: true },
  { id: '2025-12', label: 'Дек 2025' },
  { id: '2025-11', label: 'Ноя 2025' },
  { id: '2025-10', label: 'Окт 2025' },
];

const PAGE_META = {
  '/': { title: 'Дашборд', sub: 'Общая аналитика' },
  '/orders': { title: 'Заявки', sub: 'Управление перевозками' },
  '/finance': { title: 'Финансы', sub: 'Доходы и расходы' },
  '/tasks': { title: 'Задачи', sub: 'Контроль выполнения' },
  '/clients': { title: 'Клиенты', sub: 'База клиентов' },
  '/carriers': { title: 'Перевозчики', sub: 'База перевозчиков' },
  '/leads': { title: 'База обзвона', sub: 'Воронка продаж' },
};

function AppLayout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [period, setPeriod] = useState(currentMonth());
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const pathKey = '/' + location.pathname.split('/')[1];
  const meta = PAGE_META[pathKey] || { title: 'А2 Group', sub: '' };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_data');
      if (raw) setUserData(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (searchValue.length < 2) { setSearchResults(null); setShowSearch(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.globalSearch(searchValue);
        setSearchResults(r);
        setShowSearch(true);
      } catch { setSearchResults(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchValue]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
    navigate('/login');
  }, [navigate]);

  return (
    <div className="app-frame">
      <div className="aurora-static" />
      <div className="aurora-orb-a" />
      <div className="aurora-orb-b" />
      <div className="layout">
        <Sidebar
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(e => !e)}
          userData={userData}
          onLogout={handleLogout}
        />
        <div className="main-area">
          <TopBar
            title={meta.title}
            sub={meta.sub}
            period={period}
            periodOptions={PERIOD_OPTIONS}
            onPeriodChange={setPeriod}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchResults={searchResults}
            showSearch={showSearch}
            onCloseSearch={() => { setShowSearch(false); setSearchValue(''); }}
            onNavigate={navigate}
          />
          <div className="scroll-area">
            <Routes>
              <Route path="/" element={<Dashboard period={period} />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/finance" element={<Finance period={period} />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/carriers" element={<Carriers />} />
              <Route path="/carriers/:id" element={<CarrierDetail />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        } />
      </Routes>
    </HashRouter>
  );
}
