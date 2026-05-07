import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';
import { Picker } from '../../src/components/Picker';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (ym: string) => {
  if (!ym) return ym;
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const orderInPeriod = (o: any, p: string) => {
  if (p === 'all') return true;
  const ud = o.unload_date || o.load_date || (o.created_at || '').slice(0, 10);
  return ud.startsWith(p);
};

interface Withdrawal { id: string; amount: number; date: string; note?: string; }

export default function Finance() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(currentMonth());

  const [plan, setPlan] = useState('');
  const [planInput, setPlanInput] = useState('');
  const [editingPlan, setEditingPlan] = useState(false);
  const [allPlans, setAllPlans] = useState<Record<string, number>>({});

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [wAmount, setWAmount] = useState('');
  const [wNote, setWNote] = useState('');
  const [wDate, setWDate] = useState(todayISO);

  const load = useCallback(async () => {
    try {
      const [all, storedW] = await Promise.all([
        api.orders.list(),
        AsyncStorage.getItem('withdrawals'),
      ]);
      setOrders(all);
      if (storedW) setWithdrawals(JSON.parse(storedW));

      // Load plans for all months for the chart
      const months = Array.from(new Set(
        (all as any[]).map(o => {
          const d = o.unload_date || o.load_date || (o.created_at || '').slice(0, 10);
          return (d || '').slice(0, 7);
        }).filter(Boolean)
      )) as string[];
      if (months.length) {
        const pairs = await AsyncStorage.multiGet(months.map(m => `plan_${m}`));
        const plans: Record<string, number> = {};
        pairs.forEach(([k, v]) => { if (v) plans[k.replace('plan_', '')] = parseFloat(v) || 0; });
        setAllPlans(plans);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Reload plan when period changes
  useEffect(() => {
    AsyncStorage.getItem(`plan_${period}`).then(val => {
      const v = val || '';
      setPlan(v);
      setPlanInput(v);
    });
  }, [period]);

  const savePlan = async () => {
    await AsyncStorage.setItem(`plan_${period}`, planInput);
    setPlan(planInput);
    setAllPlans(prev => ({ ...prev, [period]: parseFloat(planInput) || 0 }));
    setEditingPlan(false);
  };

  const saveWithdrawal = async () => {
    const amount = parseFloat(wAmount.replace(/\s/g, '').replace(',', '.'));
    if (!amount || isNaN(amount)) { Alert.alert('Введите сумму'); return; }
    const entry: Withdrawal = { id: Date.now().toString(), amount, date: wDate, note: wNote || undefined };
    const updated = [entry, ...withdrawals];
    setWithdrawals(updated);
    await AsyncStorage.setItem('withdrawals', JSON.stringify(updated));
    setModalVisible(false);
    setWAmount(''); setWNote(''); setWDate(todayISO());
  };

  const deleteWithdrawal = async (id: string) => {
    if (!window.confirm('Удалить запись о снятии?')) return;
    const updated = withdrawals.filter(w => w.id !== id);
    setWithdrawals(updated);
    await AsyncStorage.setItem('withdrawals', JSON.stringify(updated));
  };

  const cm = currentMonth();
  const monthsInOrders = Array.from(new Set(
    orders.map(o => {
      const d = o.unload_date || o.load_date || (o.created_at || '').slice(0, 10);
      return (d || '').slice(0, 7);
    }).filter(Boolean)
  )).sort().reverse();

  const periodItems = [
    { id: 'all', label: 'За все время' },
    { id: cm, label: `Этот месяц · ${monthLabel(cm)}` },
    ...monthsInOrders.filter(m => m !== cm).map(m => ({ id: m, label: monthLabel(m) })),
  ];

  // Metrics for selected period
  const mo = orders.filter(o => orderInPeriod(o, period));
  const revenue  = mo.filter(o => o.client_paid).reduce((s, o) => s + (o.client_rate  || 0), 0);
  const expenses = mo.filter(o => o.carrier_paid).reduce((s, o) => s + (o.carrier_rate || 0), 0);
  const margin   = revenue - expenses;
  const tax      = Math.max(0, margin * 0.2);
  const netProfit = Math.max(0, margin * 0.8);
  const pendingFromClients = mo.filter(o => !o.client_paid  && o.status !== 'cancelled').reduce((s, o) => s + (o.client_rate  || 0), 0);
  const owedToCarriers     = mo.filter(o => !o.carrier_paid && o.status !== 'cancelled').reduce((s, o) => s + (o.carrier_rate || 0), 0);

  // Plan
  const planNum = parseFloat(plan) || 0;
  const pct = planNum > 0 ? (netProfit / planNum) * 100 : 0;
  const barColor = pct >= 100 ? theme.colors.profit : theme.colors.accent;

  // Withdrawals for this period
  const periodWithdrawals = period === 'all'
    ? withdrawals
    : withdrawals.filter(w => (w.date || '').startsWith(period));
  const totalWithdrawn = periodWithdrawals.reduce((s, w) => s + w.amount, 0);
  const available = netProfit - totalWithdrawn;

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.colors.bg }]}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.accent} />}
      >
        <Text style={styles.kicker}>ФИНАНСЫ</Text>
        <Text style={styles.title}>Финансы</Text>

        <Picker
          label="Период"
          value={period}
          items={periodItems}
          onSelect={(it: any) => setPeriod(it.id)}
          searchable={false}
        />

        {/* Plan card */}
        <View style={styles.card}>
          <Text style={styles.sLabel}>{period === 'all' ? 'ПЛАН НА ПЕРИОД' : 'ПЛАН НА МЕСЯЦ'}</Text>

          {editingPlan ? (
            <View style={styles.planRow}>
              <TextInput
                style={styles.planInput}
                value={planInput}
                onChangeText={setPlanInput}
                keyboardType="numeric"
                placeholder="Сумма плана, Br"
                placeholderTextColor={theme.colors.textTertiary}
                autoFocus
              />
              <TouchableOpacity onPress={savePlan} style={styles.planSaveBtn}>
                <Text style={styles.planSaveTxt}>ОК</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setPlanInput(plan); setEditingPlan(true); }} activeOpacity={0.7}>
              <Text style={styles.planValue}>
                {plan ? `${Number(plan).toLocaleString()} Br` : 'Нажмите, чтобы задать план →'}
              </Text>
            </TouchableOpacity>
          )}

          {planNum > 0 && (
            <>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={[styles.pctBig, { color: barColor }]}>{pct.toFixed(1)}%</Text>
              <Text style={styles.pctSub}>{pct >= 100 ? '🎯 перевыполнено' : 'выполнено'}</Text>
            </>
          )}
        </View>

        {/* Metrics grid */}
        <View style={styles.grid}>
          <MetricCard label="ВЫРУЧКА"            value={revenue}           color={theme.colors.profit} />
          <MetricCard label="РАСХОДЫ"            value={expenses}          color={theme.colors.loss} />
          <MetricCard label="НАЛОГ 20%"          value={tax}               color={theme.colors.textSecondary} />
          <MetricCard label="ЧИСТАЯ ПРИБЫЛЬ"     value={netProfit}         color={theme.colors.accent} highlight />
          <MetricCard label="ОЖИДАЕТСЯ ОТ КЛИЕНТОВ" value={pendingFromClients} color={theme.colors.warning} />
          <MetricCard label="К ОПЛАТЕ ПЕРЕВОЗЧИКАМ" value={owedToCarriers}     color={theme.colors.info} />
        </View>

        {/* Available to withdraw */}
        <View style={[styles.card, { marginTop: 4 }]}>
          <Text style={styles.sLabel}>ДОСТУПНО К СНЯТИЮ</Text>
          <Text style={[styles.availableNum, { color: available >= 0 ? theme.colors.accentBright : theme.colors.loss }]}>
            {formatMoney(Math.max(0, available))}
          </Text>
          {totalWithdrawn > 0 && (
            <Text style={styles.withdrawnSub}>Снято в этом периоде: {formatMoney(totalWithdrawn)}</Text>
          )}

          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.withdrawBtn} activeOpacity={0.8}>
            <Plus size={16} color="#000" strokeWidth={2.5} />
            <Text style={styles.withdrawBtnTxt}>Записать снятие</Text>
          </TouchableOpacity>

          {withdrawals.length > 0 && (
            <>
              <Text style={[styles.sLabel, { marginTop: 20, marginBottom: 0 }]}>ВСЕ СНЯТИЯ</Text>
              {withdrawals.map((w, i) => (
                <TouchableOpacity
                  key={w.id}
                  onLongPress={() => deleteWithdrawal(w.id)}
                  style={[styles.wRow, i === withdrawals.length - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wDate}>{w.date}</Text>
                    {!!w.note && <Text style={styles.wNote}>{w.note}</Text>}
                  </View>
                  <Text style={styles.wAmount}>{formatMoney(w.amount)}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        <PlanChart
          orders={orders}
          allPlans={allPlans}
          months={[...monthsInOrders].reverse()}
        />
      </ScrollView>

      {/* Withdrawal modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Записать снятие</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>

            {Platform.OS === 'web' ? (
              <>
                <input
                  type="number"
                  placeholder="Сумма, Br"
                  value={wAmount}
                  onChange={e => setWAmount(e.target.value)}
                  style={webInputStyle}
                  autoFocus
                />
                <input
                  type="date"
                  value={wDate}
                  onChange={e => setWDate(e.target.value)}
                  style={webInputStyle}
                />
                <input
                  type="text"
                  placeholder="Заметка (необязательно)"
                  value={wNote}
                  onChange={e => setWNote(e.target.value)}
                  style={webInputStyle}
                />
              </>
            ) : (
              <>
                <TextInput style={styles.mInput} placeholder="Сумма, Br" placeholderTextColor={theme.colors.textTertiary} keyboardType="numeric" value={wAmount} onChangeText={setWAmount} autoFocus />
                <TextInput style={styles.mInput} placeholder="Дата (ГГГГ-ММ-ДД)" placeholderTextColor={theme.colors.textTertiary} value={wDate} onChangeText={setWDate} />
                <TextInput style={styles.mInput} placeholder="Заметка (необязательно)" placeholderTextColor={theme.colors.textTertiary} value={wNote} onChangeText={setWNote} />
              </>
            )}

            <TouchableOpacity onPress={saveWithdrawal} style={styles.mSaveBtn} activeOpacity={0.8}>
              <Text style={styles.mSaveTxt}>Сохранить</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function MetricCard({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <View style={[styles.metricCard, highlight && { borderColor: theme.colors.accent + '50' }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{formatMoney(value)}</Text>
    </View>
  );
}

const PLAN_GOLD = '#C9A84C';
const PLAN_GREY = '#555';
const CHART_BAR_H = 100;
const CHART_LABEL_H = 24;

function PlanChart({ orders, allPlans, months }: { orders: any[]; allPlans: Record<string, number>; months: string[] }) {
  if (!months.length) return null;

  const data = months.map(ym => {
    const mo = orders.filter(o => orderInPeriod(o, ym));
    const rev = mo.filter(o => o.client_paid).reduce((s, o) => s + (o.client_rate || 0), 0);
    const exp = mo.filter(o => o.carrier_paid).reduce((s, o) => s + (o.carrier_rate || 0), 0);
    const fact = Math.max(0, (rev - exp) * 0.8);
    const plan = allPlans[ym] || 0;
    return { ym, fact, plan };
  });

  if (data.every(d => d.fact === 0 && d.plan === 0)) return null;

  const maxVal = Math.max(...data.map(d => Math.max(d.fact, d.plan)), 1);

  return (
    <View style={[styles.card, { marginTop: 8, marginBottom: 8 }]}>
      <Text style={[styles.sLabel, { marginBottom: 10 }]}>ВЫПОЛНЕНИЕ ПЛАНА ПО МЕСЯЦАМ</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ width: 10, height: 10, backgroundColor: PLAN_GOLD, borderRadius: 2 }} />
        <Text style={{ fontSize: 10, color: theme.colors.textTertiary, marginRight: 8 }}>Факт</Text>
        <View style={{ width: 10, height: 10, backgroundColor: PLAN_GREY, borderRadius: 2 }} />
        <Text style={{ fontSize: 10, color: theme.colors.textTertiary }}>План</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: CHART_BAR_H + CHART_LABEL_H + 14 }}>
          {data.map(({ ym, fact, plan }) => {
            const factH = Math.max(fact > 0 ? 2 : 0, (fact / maxVal) * CHART_BAR_H);
            const planH = Math.max(plan > 0 ? 2 : 0, (plan / maxVal) * CHART_BAR_H);
            const pct = plan > 0 ? Math.round((fact / plan) * 100) : null;
            const lbl = MONTHS[parseInt(ym.slice(5), 10) - 1];
            return (
              <View key={ym} style={{ alignItems: 'center', width: 50 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_BAR_H }}>
                  <View style={{ width: 20, height: factH, backgroundColor: PLAN_GOLD, borderRadius: 3 }} />
                  <View style={{ width: 20, height: planH, backgroundColor: PLAN_GREY, borderRadius: 3 }} />
                </View>
                {pct !== null && (
                  <Text style={{ fontSize: 8, color: pct >= 100 ? theme.colors.profit : theme.colors.accent, fontWeight: '700', marginTop: 2 }}>
                    {pct}%
                  </Text>
                )}
                <Text style={{ fontSize: 9, color: theme.colors.textTertiary, marginTop: 2 }}>{lbl}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const webInputStyle: any = {
  width: '100%',
  backgroundColor: theme.colors.surfaceElevated,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: 10,
  padding: '12px 14px',
  color: theme.colors.textPrimary,
  fontSize: 15,
  marginBottom: 12,
  boxSizing: 'border-box',
  outline: 'none',
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 6 },
  title:  { fontSize: 34, fontWeight: '300', letterSpacing: -1,  color: theme.colors.textPrimary, marginBottom: 16 },

  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 16, padding: 18, marginBottom: 12,
  },
  sLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 12 },

  planRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  planInput: {
    flex: 1, backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    color: theme.colors.textPrimary, fontSize: 16,
  },
  planSaveBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  planSaveTxt: { color: '#000', fontWeight: '700', fontSize: 13 },
  planValue: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 16 },

  progressBg: { height: 10, backgroundColor: theme.colors.surfaceElevated, borderRadius: 5, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', borderRadius: 5 },
  pctBig:  { fontSize: 52, fontWeight: '800', letterSpacing: -2, lineHeight: 56 },
  pctSub:  { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  metricCard: {
    width: '47%', flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14,
  },
  metricLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: theme.colors.textTertiary, marginBottom: 8 },
  metricValue: { fontSize: 16, fontWeight: '700', letterSpacing: -0.4 },

  availableNum: { fontSize: 44, fontWeight: '800', letterSpacing: -2, lineHeight: 48, marginBottom: 6 },
  withdrawnSub: { fontSize: 12, color: theme.colors.textTertiary, marginBottom: 4 },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.accent, paddingVertical: 12, borderRadius: 10, marginTop: 14,
  },
  withdrawBtnTxt: { color: '#000', fontSize: 14, fontWeight: '700' },

  wRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  wDate:   { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500' },
  wNote:   { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  wAmount: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '700' },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: '600' },
  mInput: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    color: theme.colors.textPrimary, fontSize: 15, marginBottom: 12,
  },
  mSaveBtn: { backgroundColor: theme.colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  mSaveTxt: { color: '#000', fontSize: 15, fontWeight: '700' },
});
