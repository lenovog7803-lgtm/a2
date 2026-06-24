import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';

const PRIORITY_COLORS = { high: '#E0473B', medium: '#D97706', low: '#1E9E5A' };
const PRIORITY_LABELS = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTasks(await api.tasks.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleDone = async (task) => {
    try {
      await api.tasks.update(task.id, { done: !task.done });
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
    } catch {}
  };

  const now = new Date();
  const q = search.trim().toLowerCase();
  const filtered = tasks.filter(t => {
    if (filter === 'active' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    if (filter === 'overdue' && (t.done || !t.due_date || new Date(t.due_date) >= now)) return false;
    if (q && !(t.title || '').toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = {
    all: tasks.length,
    active: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length,
    overdue: tasks.filter(t => !t.done && t.due_date && new Date(t.due_date) < now).length,
  };

  return (
    <div className="page-content">
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div className="chip-row" style={{ flex:1 }}>
          {[['all','Все'],['active','Активные'],['overdue','Просроченные'],['done','Выполненные']].map(([k, l]) => (
            <div key={k} className={`chip ${filter === k ? 'active' : ''} ${k === 'overdue' && filter !== 'overdue' ? '' : ''}`}
              style={k === 'overdue' && filter !== 'overdue' && counts.overdue > 0 ? { borderColor:'rgba(224,71,59,0.3)', color:'#E0473B' } : {}}
              onClick={() => setFilter(k)}>
              {l}
              <span className="chip-count">{counts[k]}</span>
            </div>
          ))}
        </div>
        <button className="btn-dark" onClick={() => { setEditTask(null); setShowModal(true); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Новая задача
        </button>
      </div>

      <div className="inline-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по задачам…" />
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <div className="tasks-list">
          {filtered.length === 0 && <div className="empty-state">Задач нет</div>}
          {filtered.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              onToggle={() => toggleDone(t)}
              onEdit={() => { setEditTask(t); setShowModal(true); }}
              onDelete={async () => { await api.tasks.delete(t.id); load(); }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <TaskModal
          task={editTask}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onEdit, onDelete }) {
  const now = new Date();
  const overdue = !task.done && task.due_date && new Date(task.due_date) < now;
  const dueFmt = task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : null;
  const pc = PRIORITY_COLORS[task.priority] || '#A6AEB8';
  const pl = PRIORITY_LABELS[task.priority] || task.priority;

  return (
    <div className="task-card" style={{ opacity: task.done ? 0.65 : 1 }}>
      <div className={`task-checkbox ${task.done ? 'done' : ''}`} onClick={onToggle}>
        {task.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      <div style={{ flex:1, minWidth:0 }} onClick={onEdit}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
          <span style={{ fontSize:14, fontWeight:600, color:'#0E1726', textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</span>
          {task.priority && <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:6, background:`${pc}18`, color: pc }}>{pl}</span>}
        </div>
        {task.description && <div style={{ fontSize:12.5, color:'#5A6573', marginBottom:6 }}>{task.description}</div>}
        {dueFmt && <div style={{ fontSize:11.5, color: overdue ? '#E0473B' : '#8A93A0', fontWeight: overdue ? 700 : 500 }}>
          {overdue ? '⚠ Просрочено · ' : '📅 '}{dueFmt}
        </div>}
        {task.assignee && <div style={{ fontSize:11.5, color:'#A6AEB8', marginTop:4 }}>👤 {task.assignee}</div>}
      </div>
      <div style={{ display:'flex', gap:4 }}>
        <button onClick={onEdit} style={{ background:'none', border:'none', cursor:'pointer', color:'#A6AEB8', padding:4 }}
          title="Редактировать">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button onClick={onDelete} style={{ background:'none', border:'none', cursor:'pointer', color:'#C4CAD2', padding:4 }}
          title="Удалить">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function TaskModal({ task, onClose, onSaved }) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    due_date: task?.due_date ? task.due_date.slice(0, 16) : '',
    priority: task?.priority || 'medium',
    assignee: task?.assignee || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await api.tasks.update(task.id, form);
      else await api.tasks.create(form);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать задачу' : 'Новая задача'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Название *</label>
            <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Что нужно сделать?" required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Подробности…" rows={3} style={{ resize:'vertical' }} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Срок</label>
              <input className="form-input" type="datetime-local" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Приоритет</label>
              <select className="form-input form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Исполнитель</label>
            <input className="form-input" value={form.assignee} onChange={e => set('assignee', e.target.value)} placeholder="Имя сотрудника" />
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" className="btn-ghost" style={{ flex:1 }} onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-accent" style={{ flex:2, justifyContent:'center' }} disabled={saving}>{saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
