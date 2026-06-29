import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

const STATUSES = ['new', 'in_progress', 'delivered', 'cancelled'];
const STATUS_LABELS = { new: 'Новая', in_progress: 'В работе', delivered: 'Доставлено', cancelled: 'Отменено' };

export default function OrderModal({ order, onClose, onSaved }) {
  const isEdit = !!order;
  const [form, setForm] = useState({
    number: '', client_name: '', carrier_name: '',
    load_address: '', unload_address: '',
    load_date: '', unload_date: '',
    client_rate: '', carrier_rate: '',
    cargo: '', weight: '',
    status: 'new', client_paid: false, carrier_paid: false,
    driver_name: '', driver_phone: '', plate: '', vehicle_type: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [carriers, setCarriers] = useState([]);

  useEffect(() => {
    api.clients.list().then(setClients).catch(() => {});
    api.carriers.list().then(setCarriers).catch(() => {});
    if (isEdit) {
      setForm(f => ({ ...f, ...order,
        client_rate: order.client_rate ?? '',
        carrier_rate: order.carrier_rate ?? '',
        weight: order.weight ?? '',
      }));
    } else {
      api.orders.nextNumber().then(r => setForm(f => ({ ...f, number: r.number || '' }))).catch(() => {});
    }
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, client_rate: Number(form.client_rate) || 0, carrier_rate: Number(form.carrier_rate) || 0, weight: form.weight ? Number(form.weight) : undefined };
      if (isEdit) await api.orders.update(order.id, payload);
      else await api.orders.create(payload);
      onSaved();
    } catch (err) { alert('Ошибка: ' + err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-wide">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? `Заявка ${order.number}` : 'Новая заявка'}</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Номер</label>
              <input className="form-input" value={form.number} onChange={e => set('number', e.target.value)} placeholder="А2-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-input form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Клиент</label>
              <input className="form-input" list="clients-list" value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Название клиента" />
              <datalist id="clients-list">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Перевозчик</label>
              <input className="form-input" list="carriers-list" value={form.carrier_name} onChange={e => set('carrier_name', e.target.value)} placeholder="Название перевозчика" />
              <datalist id="carriers-list">{carriers.map(c => <option key={c.id} value={c.company_name} />)}</datalist>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Адрес загрузки</label>
              <input className="form-input" value={form.load_address} onChange={e => set('load_address', e.target.value)} placeholder="Город, улица" />
            </div>
            <div className="form-group">
              <label className="form-label">Адрес выгрузки</label>
              <input className="form-input" value={form.unload_address} onChange={e => set('unload_address', e.target.value)} placeholder="Город, улица" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Дата загрузки</label>
              <input className="form-input" type="date" value={form.load_date} onChange={e => set('load_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Дата выгрузки</label>
              <input className="form-input" type="date" value={form.unload_date} onChange={e => set('unload_date', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ставка клиента (Br)</label>
              <input className="form-input" type="number" value={form.client_rate} onChange={e => set('client_rate', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Ставка перевозчика (Br)</label>
              <input className="form-input" type="number" value={form.carrier_rate} onChange={e => set('carrier_rate', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Груз</label>
              <input className="form-input" value={form.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Наименование груза" />
            </div>
            <div className="form-group">
              <label className="form-label">Вес (т)</label>
              <input className="form-input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Водитель / перевозчик</label>
              <input className="form-input" value={form.driver_name} onChange={e => set('driver_name', e.target.value)} placeholder="ФИО водителя" />
            </div>
            <div className="form-group">
              <label className="form-label">Телефон водителя</label>
              <input className="form-input" value={form.driver_phone} onChange={e => set('driver_phone', e.target.value)} placeholder="+375 XX XXX XX XX" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Госномер</label>
              <input className="form-input" value={form.plate} onChange={e => set('plate', e.target.value)} placeholder="А 000 АА" />
            </div>
            <div className="form-group">
              <label className="form-label">Тип авто</label>
              <input className="form-input" value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)} placeholder="Тент, рефрижератор…" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Примечания</label>
            <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Доп. информация" rows={3} style={{ resize:'vertical' }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:24, marginBottom:24 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, color:'#0E1726' }}>
              <input type="checkbox" checked={form.client_paid} onChange={e => set('client_paid', e.target.checked)} />
              Клиент оплатил
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, color:'#0E1726' }}>
              <input type="checkbox" checked={form.carrier_paid} onChange={e => set('carrier_paid', e.target.checked)} />
              Перевозчик оплачен
            </label>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button type="button" className="btn-ghost" style={{ flex:1 }} onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-accent" style={{ flex:2, justifyContent:'center' }} disabled={saving}>
              {saving ? 'Сохранение…' : isEdit ? 'Сохранить изменения' : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
