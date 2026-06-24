import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!login || !password) { setError('Введите логин и пароль'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.auth.login(login, password);
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('user_role', data.role || '');
      localStorage.setItem('user_data', JSON.stringify(data.user || data));
      navigate('/');
    } catch (err) {
      setError('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-frame">
      <div className="aurora-static" />
      <div className="aurora-orb-a" />
      <div className="aurora-orb-b" />
      <div className="login-page" style={{ position: 'relative', zIndex: 1 }}>
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-logo">А2</div>
          <div className="login-title">А2 Group CRM</div>
          <div className="login-sub">Войдите в систему управления</div>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Логин</label>
            <input
              className="form-input"
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="Введите логин"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Пароль</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="btn-dark"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, paddingTop: 13, paddingBottom: 13 }}
            disabled={loading}
          >
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
