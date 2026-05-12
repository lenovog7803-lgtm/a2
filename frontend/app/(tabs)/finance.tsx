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
const QUARTERS = [
  { name: 'Q1', months: [1, 2, 3],   label: 'Янв–Мар' },
  { name: 'Q2', months: [4, 5, 6],   label: 'Апр–Июн' },
  { name: 'Q3', months: [7, 8, 9],   label: 'Июл–Сен' },
  { name: 'Q4', months: [10, 11, 12], label: 'Окт–Дек' },
];

type TabType = 'orders' | 'accounting';

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

function FinanceInner() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabType>('orders');
  const [accPeriod, setAccPeriod] = useState<string>(currentMonth()); // 'all' | YYYY-MM | 'qN'
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(currentMonth());

  const [plan, setPlan] = useState('');
  const [planInput, setPlanInput] = useState('');
  const [editingPlan, setEditingPlan] = useState(false);
  const [allPlans, setAllPlans] = useState<Record<string, number>>({});

  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [wModalVisible, setWModalVisible] = useState(false);
  const [wAmount, setWAmount] = useState('');
  const [wNote, setWNote] = useState('');
  const [wDate, setWDate] = useState(todayISO);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState(todayISO);

  const load = useCallback(async () => {
    try {
      const [allOrders, ws, txs] = await Promise.all([
        api.orders.list(),
        api.finance.withdrawals.list().catch(() => []),
        api.finance.transactions.list().catch(() => []),
      ]);
      setOrders(allOrders);
      setWithdrawals(ws);
      setTransactions(txs);

      const months = Array.from(new Set(
        (allOrders as any[]).map(o => {
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
    try {
      const entry = await api.finance.withdrawals.create({ amount, date: wDate, note: wNote || '' });
      setWithdrawals(prev => [entry, ...prev]);
      setWModalVisible(false);
      setWAmount(''); setWNote(''); setWDate(todayISO());
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const deleteWithdrawal = (id: string) => {
    Alert.alert('Удалить снятие?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.finance.withdrawals.delete(id);
        setWithdrawals(prev => prev.filter(w => w.id !== id));
      }},
    ]);
  };

  const saveTransaction = async () => {
    const amount = parseFloat(txAmount.replace(/\s/g, '').replace(',', '.'));
    if (!amount || isNaN(amount)) { Alert.alert('Введите сумму'); return; }
    try {
      const entry = await api.finance.transactions.create({ type: txType, amount, date: txDate, description: txDesc || '' });
      setTransactions(prev => [entry, ...prev]);
      setTxModalVisible(false);
      setTxAmount(''); setTxDesc(''); setTxDate(todayISO());
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const deleteTransaction = (id: string) => {
    Alert.alert('Удалить транзакцию?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.finance.transactions.delete(id);
        setTransactions(prev => prev.filter(t => t.id !== id));
      }},
    ]);
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

  // === "По заявкам" metrics (ALL orders, regardless of payment) ===
  const mo = orders.filter(o => orderInPeriod(o, period));
  const revenue  = mo.reduce((s, o) => s + (o.client_rate  || 0), 0);
  const expenses = mo.reduce((s, o) => s + (o.carrier_rate || 0), 0);
  const margin   = revenue - expenses;
  const tax      = Math.max(0, margin * 0.2);
  const netProfit = Math.max(0, margin * 0.8);

  const periodWithdrawals = period === 'all'
    ? withdrawals
    : withdrawals.filter(w => (w.date || '').startsWith(period));
  const totalWithdrawn = periodWithdrawals.reduce((s, w) => s + w.amount, 0);
  const available = netProfit - totalWithdrawn;

  const planNum = parseFloat(plan) || 0;
  const pct = planNum > 0 ? (netProfit / planNum) * 100 : 0;
  const barColor = pct >= 100 ? theme.colors.profit : theme.colors.accent;

  // === "Бухгалтерия" — helper to resolve effective paid date (with unload_date fallback) ===
  const currentYear = new Date().getFullYear();
  const currentQuarterIdx = Math.floor(new Date().getMonth() / 3);

  const clientEffDate = (o: any): string => o.client_paid_date || o.unload_date || '';
  const carrierEffDate = (o: any): string => o.carrier_paid_date || o.unload_date || '';

  // Filter by accPeriod: 'all' | YYYY-MM | 'q0'..'q3'
  const accInPeriod = (dateStr: string): boolean => {
    if (accPeriod === 'all') return true;
    if (!dateStr) return false;
    if (accPeriod.startsWith('q')) {
      const qIdx = parseInt(accPeriod[1], 10);
      const [y, m] = dateStr.split('-').map(Number);
      return y === currentYear && QUARTERS[qIdx].months.includes(m);
    }
    return dateStr.startsWith(accPeriod);
  };

  const accOrderIncome = orders
    .filter(o => o.client_paid && accInPeriod(clientEffDate(o)))
    .reduce((s, o) => s + (o.client_rate || 0), 0);
  const accOrderExpenses = orders
    .filter(o => o.carrier_paid && accInPeriod(carrierEffDate(o)))
    .reduce((s, o) => s + (o.carrier_rate || 0), 0);

  const periodTxs = transactions.filter(t => accInPeriod(t.date || ''));
  const manualIncome   = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const manualExpenses = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const totalAccIncome   = accOrderIncome + manualIncome;
  const totalAccExpenses = accOrderExpenses + manualExpenses;
  const accProfit    = totalAccIncome - totalAccExpenses;
  const accTax       = Math.max(0, accProfit * 0.2);
  const accNetProfit = Math.max(0, accProfit * 0.8);

  // Accounting period label
  const accPeriodLabel = accPeriod === 'all'
    ? 'За все время'
    : accPeriod.startsWith('q')
      ? `${QUARTERS[parseInt(accPeriod[1], 10)].name} ${QUARTERS[parseInt(accPeriod[1], 10)].label} ${currentYear}`
      : monthLabel(accPeriod);

  // === Quarterly data (by paid dates, always current year) ===
  const quarterData = QUARTERS.map((q, qi) => {
    const inQuarter = (dateStr: string): boolean => {
      if (!dateStr) return false;
      const [y, m] = dateStr.split('-').map(Number);
      return y === currentYear && q.months.includes(m);
    };
    const qIncome = orders
      .filter(o => o.client_paid && inQuarter(clientEffDate(o)))
      .reduce((s, o) => s + (o.client_rate || 0), 0);
    const qExpenses = orders
      .filter(o => o.carrier_paid && inQuarter(carrierEffDate(o)))
      .reduce((s, o) => s + (o.carrier_rate || 0), 0);
    const qTx = transactions.filter(t => inQuarter(t.date || ''));
    const qManualInc = qTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const qManualExp = qTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalInc = qIncome + qManualInc;
    const totalExp = qExpenses + qManualExp;
    const qProfit = totalInc - totalExp;
    return {
      ...q,
      income: totalInc,
      expenses: totalExp,
      profit: qProfit,
      tax: Math.max(0, qProfit * 0.2),
      netProfit: Math.max(0, qProfit * 0.8),
      isCurrent: qi === currentQuarterIdx,
    };
  });

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

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'orders' && styles.tabBtnActive]} onPress={() => setTab('orders')} activeOpacity={0.7}>
            <Text style={[styles.tabBtnTxt, tab === 'orders' && styles.tabBtnTxtActive]}>По заявкам</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'accounting' && styles.tabBtnActive]} onPress={() => setTab('accounting')} activeOpacity={0.7}>
            <Text style={[styles.tabBtnTxt, tab === 'accounting' && styles.tabBtnTxtActive]}>Бухгалтерия</Text>
          </TouchableOpacity>
        </View>

        <Picker
          label="Период"
          value={period}
          items={periodItems}
          onSelect={(it: any) => setPeriod(it.id)}
          searchable={false}
        />

        {tab === 'orders' ? (
          <>
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
              <MetricCard label="ВЫРУЧКА"        value={revenue}   color={theme.colors.profit} />
              <MetricCard label="РАСХОДЫ"        value={expenses}  color={theme.colors.loss} />
              <MetricCard label="МАРЖА"          value={margin}    color={theme.colors.textSecondary} />
              <MetricCard label="НАЛОГ 20%"      value={tax}       color={theme.colors.textSecondary} />
              <MetricCard label="ЧИСТАЯ ПРИБЫЛЬ" value={netProfit} color={theme.colors.accent} highlight />
            </View>

            {/* Available to withdraw */}
            <View style={[styles.card, { marginTop: 4 }]}>
              <Text style={styles.sLabel}>ДОСТУПНО К СНЯТИЮ</Text>
              <Text style={[styles.availableNum, { color: available >= 0 ? theme.colors.accentBright : theme.colors.loss }]}>
                {formatMoney(Math.max(0, available))}
              </Text>
              {totalWithdrawn > 0 && (
                <Text style={styles.withdrawnSub}>Снято за период: {formatMoney(totalWithdrawn)}</Text>
              )}
              <TouchableOpacity onPress={() => setWModalVisible(true)} style={styles.withdrawBtn} activeOpacity={0.8}>
                <Plus size={16} color="#000" strokeWidth={2.5} />
                <Text style={styles.withdrawBtnTxt}>Записать снятие</Text>
              </TouchableOpacity>
              {periodWithdrawals.length > 0 && (
                <>
                  <Text style={[styles.sLabel, { marginTop: 20, marginBottom: 0 }]}>СНЯТИЯ ЗА ПЕРИОД</Text>
                  {periodWithdrawals.map((w, i) => (
                    <TouchableOpacity
                      key={w.id}
                      onLongPress={() => deleteWithdrawal(w.id)}
                      style={[styles.wRow, i === periodWithdrawals.length - 1 && { borderBottomWidth: 0 }]}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.wDate}>{w.date}</Text>
                        {!!w.note && <Text style={styles.wNote}>{w.note}</Text>}
                      </View>
                      <Text style={styles.wAmount}>{formatMoney(w.amount)}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.wTotalRow}>
                    <Text style={styles.wTotalLabel}>Итого снято:</Text>
                    <Text style={styles.wTotalValue}>{formatMoney(totalWithdrawn)}</Text>
                  </View>
                </>
              )}
            </View>

            <PlanChart orders={orders} allPlans={allPlans} months={[...monthsInOrders].reverse()} />
          </>
        ) : (
          <>
            {/* Accounting period switcher */}
            <View style={styles.accSegRow}>
              {([
                { id: cm,                      label: `Месяц · ${monthLabel(cm)}` },
                { id: `q${currentQuarterIdx}`, label: `${QUARTERS[currentQuarterIdx].name} · ${QUARTERS[currentQuarterIdx].label}` },
                { id: 'all',                   label: 'За все время' },
              ] as { id: string; label: string }[]).map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.accSegBtn, accPeriod === opt.id && styles.accSegBtnActive]}
                  onPress={() => setAccPeriod(opt.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.accSegTxt, accPeriod === opt.id && styles.accSegTxtActive]} numberOfLines={1}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.sLabel, { marginBottom: 10 }]}>{accPeriodLabel.toUpperCase()}</Text>

            {/* Accounting summary */}
            <View style={styles.grid}>
              <MetricCard label="ДОХОДЫ"        value={totalAccIncome}   color={theme.colors.profit} />
              <MetricCard label="РАСХОДЫ"       value={totalAccExpenses} color={theme.colors.loss} />
              <MetricCard label="ПРИБЫЛЬ"       value={accProfit}        color={accProfit >= 0 ? theme.colors.textSecondary : theme.colors.loss} />
              <MetricCard label="НАЛОГ 20%"     value={accTax}           color={theme.colors.textSecondary} />
              <MetricCard label="ЧИСТАЯ ПРИБЫЛЬ" value={accNetProfit}   color={theme.colors.accent} highlight />
            </View>

            {/* Quarterly breakdown */}
            <Text style={[styles.sLabel, { marginBottom: 8 }]}>КВАРТАЛЫ {currentYear}</Text>
            {quarterData.map(q => (
              <View key={q.name} style={[styles.quarterCard, q.isCurrent && { borderColor: theme.colors.accent + '60' }]}>
                <View style={styles.quarterHeader}>
                  <Text style={[styles.quarterName, q.isCurrent && { color: theme.colors.accent }]}>{q.name}</Text>
                  <Text style={styles.quarterPeriod}>{q.label}</Text>
                  {q.isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeTxt}>текущий</Text>
                    </View>
                  )}
                </View>
                <View style={styles.quarterRow}>
                  <View style={styles.quarterItem}>
                    <Text style={styles.quarterMetaLabel}>Доходы</Text>
                    <Text style={[styles.quarterValue, { color: theme.colors.profit }]}>{formatMoney(q.income)}</Text>
                  </View>
                  <View style={styles.quarterItem}>
                    <Text style={styles.quarterMetaLabel}>Расходы</Text>
                    <Text style={[styles.quarterValue, { color: theme.colors.loss }]}>{formatMoney(q.expenses)}</Text>
                  </View>
                  <View style={styles.quarterItem}>
                    <Text style={styles.quarterMetaLabel}>Прибыль</Text>
                    <Text style={[styles.quarterValue, { color: q.profit >= 0 ? theme.colors.accent : theme.colors.loss }]}>{formatMoney(q.profit)}</Text>
                  </View>
                  <View style={styles.quarterItem}>
                    <Text style={styles.quarterMetaLabel}>Налог 20%</Text>
                    <Text style={[styles.quarterValue, { color: theme.colors.textSecondary }]}>{formatMoney(q.tax)}</Text>
                  </View>
                </View>
              </View>
            ))}

            <AccountingChart orders={orders} transactions={transactions} year={currentYear} />

            {/* Manual transactions */}
            <View style={[styles.card, { marginTop: 4 }]}>
              <Text style={styles.sLabel}>РУЧНЫЕ ТРАНЗАКЦИИ</Text>
              <TouchableOpacity onPress={() => setTxModalVisible(true)} style={styles.withdrawBtn} activeOpacity={0.8}>
                <Plus size={16} color="#000" strokeWidth={2.5} />
                <Text style={styles.withdrawBtnTxt}>Добавить доход / расход</Text>
              </TouchableOpacity>
              {periodTxs.length > 0 ? (
                periodTxs.map((t, i) => (
                  <TouchableOpacity
                    key={t.id}
                    onLongPress={() => deleteTransaction(t.id)}
                    style={[styles.wRow, i === periodTxs.length - 1 && { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wDate}>{t.date}</Text>
                      {!!t.description && <Text style={styles.wNote}>{t.description}</Text>}
                    </View>
                    <Text style={[styles.wAmount, { color: t.type === 'income' ? theme.colors.profit : theme.colors.loss }]}>
                      {t.type === 'income' ? '+' : '−'}{formatMoney(t.amount)}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ color: theme.colors.textTertiary, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                  Нет транзакций за период
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Withdrawal modal */}
      <Modal visible={wModalVisible} transparent animationType="slide" onRequestClose={() => setWModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setWModalVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Записать снятие</Text>
              <TouchableOpacity onPress={() => setWModalVisible(false)}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            {Platform.OS === 'web' ? (
              <>
                <input type="number" placeholder="Сумма, Br" value={wAmount} onChange={e => setWAmount((e.target as any).value)} style={webInputStyle} autoFocus />
                <input type="date" value={wDate} onChange={e => setWDate((e.target as any).value)} style={webInputStyle} />
                <input type="text" placeholder="Заметка (необязательно)" value={wNote} onChange={e => setWNote((e.target as any).value)} style={webInputStyle} />
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

      {/* Transaction modal */}
      <Modal visible={txModalVisible} transparent animationType="slide" onRequestClose={() => setTxModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setTxModalVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Добавить транзакцию</Text>
              <TouchableOpacity onPress={() => setTxModalVisible(false)}>
                <X size={20} color={theme.colors.textSecondary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.typeBtn, txType === 'income' && { backgroundColor: theme.colors.profit + '20', borderColor: theme.colors.profit }]}
                onPress={() => setTxType('income')}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeBtnTxt, txType === 'income' && { color: theme.colors.profit }]}>+ Доход</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, txType === 'expense' && { backgroundColor: theme.colors.loss + '20', borderColor: theme.colors.loss }]}
                onPress={() => setTxType('expense')}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeBtnTxt, txType === 'expense' && { color: theme.colors.loss }]}>− Расход</Text>
              </TouchableOpacity>
            </View>
            {Platform.OS === 'web' ? (
              <>
                <input type="number" placeholder="Сумма, Br" value={txAmount} onChange={e => setTxAmount((e.target as any).value)} style={webInputStyle} autoFocus />
                <input type="date" value={txDate} onChange={e => setTxDate((e.target as any).value)} style={webInputStyle} />
                <input type="text" placeholder="Описание" value={txDesc} onChange={e => setTxDesc((e.target as any).value)} style={webInputStyle} />
              </>
            ) : (
              <>
                <TextInput style={styles.mInput} placeholder="Сумма, Br" placeholderTextColor={theme.colors.textTertiary} keyboardType="numeric" value={txAmount} onChangeText={setTxAmount} autoFocus />
                <TextInput style={styles.mInput} placeholder="Дата (ГГГГ-ММ-ДД)" placeholderTextColor={theme.colors.textTertiary} value={txDate} onChangeText={setTxDate} />
                <TextInput style={styles.mInput} placeholder="Описание" placeholderTextColor={theme.colors.textTertiary} value={txDesc} onChangeText={setTxDesc} />
              </>
            )}
            <TouchableOpacity onPress={saveTransaction} style={styles.mSaveBtn} activeOpacity={0.8}>
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
    const rev = mo.reduce((s, o) => s + (o.client_rate || 0), 0);
    const exp = mo.reduce((s, o) => s + (o.carrier_rate || 0), 0);
    const fact = Math.max(0, (rev - exp) * 0.8);
    const plan = allPlans[ym] || 0;
    return { ym, fact, plan };
  });

  if (data.every(d => d.fact === 0 && d.plan === 0)) return null;

  const maxVal = Math.max(...data.map(d => Math.max(d.fact, d.plan)), 1);

  return (
    <View style={[styles.card, { marginTop: 8, marginBottom: 8 }]}>
      <Text style={[styles.sLabel, { marginBottom: 10 }]}>ЧИСТАЯ ПРИБЫЛЬ ПО МЕСЯЦАМ</Text>
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

function AccountingChart({ orders, transactions, year }: { orders: any[]; transactions: any[]; year: number }) {
  const data = MONTHS.map((label, i) => {
    const m = String(i + 1).padStart(2, '0');
    const ym = `${year}-${m}`;
    const income = orders
      .filter(o => o.client_paid && (o.client_paid_date || o.unload_date || o.load_date || '').startsWith(ym))
      .reduce((s, o) => s + (o.client_rate || 0), 0);
    const expenses = orders
      .filter(o => o.carrier_paid && (o.carrier_paid_date || o.unload_date || o.load_date || '').startsWith(ym))
      .reduce((s, o) => s + (o.carrier_rate || 0), 0);
    const txs = transactions.filter(t => (t.date || '').startsWith(ym));
    const manualInc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const manualExp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { label, ym, income: income + manualInc, expenses: expenses + manualExp };
  });

  if (data.every(d => d.income === 0 && d.expenses === 0)) return null;

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);
  const H = 100;

  return (
    <View style={[styles.card, { marginTop: 8, marginBottom: 8 }]}>
      <Text style={[styles.sLabel, { marginBottom: 10 }]}>ДОХОДЫ / РАСХОДЫ ПО МЕСЯЦАМ {year}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ width: 10, height: 10, backgroundColor: theme.colors.profit, borderRadius: 2 }} />
        <Text style={{ fontSize: 10, color: theme.colors.textTertiary, marginRight: 8 }}>Доходы</Text>
        <View style={{ width: 10, height: 10, backgroundColor: theme.colors.loss, borderRadius: 2 }} />
        <Text style={{ fontSize: 10, color: theme.colors.textTertiary }}>Расходы</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: H + 24 }}>
          {data.map(({ label, ym, income, expenses }) => {
            const incH = Math.max(income > 0 ? 2 : 0, (income / maxVal) * H);
            const expH = Math.max(expenses > 0 ? 2 : 0, (expenses / maxVal) * H);
            return (
              <View key={ym} style={{ alignItems: 'center', width: 44 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: H }}>
                  <View style={{ width: 18, height: incH, backgroundColor: theme.colors.profit, borderRadius: 3 }} />
                  <View style={{ width: 18, height: expH, backgroundColor: theme.colors.loss, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 9, color: theme.colors.textTertiary, marginTop: 4 }}>{label}</Text>
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

  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, padding: 4, marginBottom: 14, gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: theme.colors.accent },
  tabBtnTxt: { fontSize: 13, fontWeight: '600', color: theme.colors.textTertiary },
  tabBtnTxtActive: { color: '#000' },

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
  wTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.border },
  wTotalLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: theme.colors.textSecondary },
  wTotalValue: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },

  quarterCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  quarterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  quarterName:   { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  quarterPeriod: { fontSize: 12, color: theme.colors.textTertiary, flex: 1 },
  currentBadge:  { backgroundColor: theme.colors.accent + '20', borderWidth: 1, borderColor: theme.colors.accent + '40', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  currentBadgeTxt: { fontSize: 10, color: theme.colors.accent, fontWeight: '700' },
  quarterRow:    { flexDirection: 'row', gap: 8 },
  quarterItem:   { flex: 1 },
  quarterMetaLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.textTertiary, marginBottom: 4 },
  quarterValue:  { fontSize: 14, fontWeight: '700' },

  accSegRow: {
    flexDirection: 'row', gap: 6, marginBottom: 12,
  },
  accSegBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  accSegBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  accSegTxt: { fontSize: 11, fontWeight: '600', color: theme.colors.textTertiary },
  accSegTxtActive: { color: '#000' },

  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated,
  },
  typeBtnTxt: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },

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

export default function Finance() {
  const [role, setRole] = useState('');
  useEffect(() => {
    AsyncStorage.getItem('user_role').then(r => setRole(r || '')).catch(() => {});
  }, []);
  if (role === 'manager') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.textTertiary, fontSize: 16, fontWeight: '600' }}>Нет доступа</Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: 13, marginTop: 8 }}>Финансы доступны только администратору</Text>
      </View>
    );
  }
  return <FinanceInner />;
}
