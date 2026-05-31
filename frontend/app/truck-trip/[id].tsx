import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const STATUSES = ['новая', 'в работе', 'выполнен', 'отменён'];
const PAY_CLIENT = ['не оплачен', 'частично', 'оплачен'];
const PAY_INVESTOR = ['не выплачено', 'выплачено'];

export default function TruckTripDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [computed, setComputed] = useState<any>({});

  useEffect(() => {
    Promise.all([
      api.truck.trips.get(id!),
      api.truck.clients.list(),
    ]).then(([trip, cls]: any) => {
      setForm({ ...trip });
      setComputed({ rate_investor: trip.rate_investor, bonus_amount: trip.bonus_amount, fuel_liters_plan: trip.fuel_liters_plan, fuel_cost_plan: trip.fuel_cost_plan });
      setClients(cls);
    }).catch(() => Alert.alert('Ошибка загрузки')).finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      ['cargo_weight', 'pallets', 'rate_client', 'mileage', 'driver_salary_trip', 'fuel_liters_fact', 'carrier_payment_days'].forEach(k => {
        if (payload[k] !== '' && payload[k] !== undefined && payload[k] !== null) payload[k] = Number(payload[k]);
      });
      const updated = await api.truck.trips.update(id!, payload) as any;
      setComputed({ rate_investor: updated.rate_investor, bonus_amount: updated.bonus_amount, fuel_liters_plan: updated.fuel_liters_plan, fuel_cost_plan: updated.fuel_cost_plan });
      Alert.alert('Сохранено');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    setSaving(false);
  };

  const remove = () => {
    Alert.alert('Удалить рейс?', 'Действие необратимо', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.truck.trips.remove(id!);
        router.back();
      }},
    ]);
  };

  const investorDeadline = form.investor_payment_deadline
    ? new Date(form.investor_payment_deadline).toLocaleDateString('ru-RU')
    : null;

  const businessDaysLeft = (): number | null => {
    if (!form.investor_payment_deadline) return null;
    const deadline = new Date(form.investor_payment_deadline);
    const now = new Date();
    let diff = 0;
    const cur = new Date(now);
    while (cur < deadline) {
      cur.setDate(cur.getDate() + 1);
      if (cur.getDay() !== 0 && cur.getDay() !== 6) diff++;
    }
    return diff;
  };
  const daysLeft = businessDaysLeft();

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <View>
          <Text style={styles.title}>{form.trip_number || 'Рейс'}</Text>
          <Text style={styles.subtitle}>{form.route || ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={remove}><Trash2 size={20} color={theme.colors.loss} /></TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Авторасчёт */}
        <View style={styles.calcBlock}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Аренда инвестору</Text>
            <Text style={styles.calcValue}>{formatMoney(computed.rate_investor ?? 0)}</Text>
          </View>
          {(computed.bonus_amount ?? 0) > 0 && (
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: theme.colors.accentBright }]}>🎁 Бонус инвестору</Text>
              <Text style={[styles.calcValue, { color: theme.colors.accentBright }]}>+{formatMoney(computed.bonus_amount)}</Text>
            </View>
          )}
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Топливо план</Text>
            <Text style={styles.calcValue}>{computed.fuel_liters_plan ?? 0} л / {formatMoney(computed.fuel_cost_plan ?? 0)}</Text>
          </View>
          {investorDeadline && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Срок выплаты инвестору</Text>
              <Text style={[styles.calcValue, { color: (daysLeft ?? 99) < 5 ? theme.colors.loss : theme.colors.textSecondary }]}>
                {investorDeadline}{daysLeft !== null ? ` (${daysLeft} раб. дн.)` : ''}
              </Text>
            </View>
          )}
        </View>

        <Section title="Основное">
          <Field label="Маршрут" value={form.route} onChangeText={v => set('route', v)} />
          <Field label="Тип груза" value={form.cargo_type} onChangeText={v => set('cargo_type', v)} />
          <Field label="Вес, тн" value={form.cargo_weight} onChangeText={v => set('cargo_weight', v)} keyboardType="numeric" />
          <Field label="Палет" value={form.pallets} onChangeText={v => set('pallets', v)} keyboardType="numeric" />
          <Field label="Дата загрузки" value={form.date_loading} onChangeText={v => set('date_loading', v)} />
          <Field label="Дата выгрузки" value={form.date_unloading} onChangeText={v => set('date_unloading', v)} />
        </Section>

        <Section title="Клиент">
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Клиент</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {clients.map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, form.client_id === c.id && styles.chipActive]}
                    onPress={() => { set('client_id', c.id); set('client_name', c.name); }}
                  >
                    <Text style={[styles.chipText, form.client_id === c.id && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={styles.input}
              value={form.client_name ?? ''}
              onChangeText={v => set('client_name', v)}
              placeholder="Имя клиента"
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
        </Section>

        <Section title="Финансы">
          <Field label="Ставка клиента, BYN" value={form.rate_client} onChangeText={v => set('rate_client', v)} keyboardType="numeric" />
          <Field label="Пробег, км" value={form.mileage} onChangeText={v => set('mileage', v)} keyboardType="numeric" />
          <Field label="Топливо факт, л" value={form.fuel_liters_fact} onChangeText={v => set('fuel_liters_fact', v)} keyboardType="numeric" />
          <Field label="Водитель за рейс, BYN" value={form.driver_salary_trip} onChangeText={v => set('driver_salary_trip', v)} keyboardType="numeric" />
        </Section>

        <Section title="Водитель">
          <Field label="Имя водителя" value={form.driver_name} onChangeText={v => set('driver_name', v)} />
        </Section>

        <Section title="Статус">
          <PickerRow label="Статус рейса" options={STATUSES} value={form.status} onChange={v => set('status', v)} />
          <PickerRow label="Оплата клиент" options={PAY_CLIENT} value={form.payment_client_status} onChange={v => set('payment_client_status', v)} />
          <PickerRow label="Выплата инвестору" options={PAY_INVESTOR} value={form.payment_investor_status} onChange={v => set('payment_investor_status', v)} />
          <Field label="Банковских дней на выплату" value={form.carrier_payment_days} onChangeText={v => set('carrier_payment_days', v)} keyboardType="numeric" />
        </Section>

        <Section title="Документы">
          <CheckRow label="Документы отправлены клиенту" value={form.documents_sent_client} onChange={v => set('documents_sent_client', v)} />
          <CheckRow label="Документы получены от инвестора" value={form.documents_received_investor} onChange={v => set('documents_received_investor', v)} />
        </Section>

        <Section title="Примечания">
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={form.notes ?? ''}
            onChangeText={v => set('notes', v)}
            multiline
            placeholder="Заметки..."
            placeholderTextColor={theme.colors.textTertiary}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value !== null && value !== undefined ? String(value) : ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

function PickerRow({ label, options, value, onChange }: any) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {options.map((o: string) => (
            <TouchableOpacity key={o} style={[styles.chip, value === o && styles.chipActive]} onPress={() => onChange(o)}>
              <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function CheckRow({ label, value, onChange }: any) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => onChange(!value)}>
      <View style={[styles.checkbox, value && styles.checkboxActive]}>
        {value && <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  subtitle: { fontSize: 12, color: theme.colors.textTertiary },
  saveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 60 },
  calcBlock: {
    backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  calcLabel: { fontSize: 13, color: theme.colors.textSecondary },
  calcValue: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  fieldRow: { marginBottom: 10 },
  label: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.textPrimary,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.borderStrong,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  checkboxActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkLabel: { fontSize: 14, color: theme.colors.textPrimary },
});
