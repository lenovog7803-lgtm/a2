import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Pencil, Check, X } from 'lucide-react-native';
import { theme, formatShort } from '../theme';
import { api } from '../api';

const PLAN_MONTHS = [
  { ym: '2026-06', label: 'Июнь',    marginGoal: 7500,  tripsGoal: 35, milestone: 'Старт outbound' },
  { ym: '2026-07', label: 'Июль',    marginGoal: 8500,  tripsGoal: 40, milestone: 'Пик сезона' },
  { ym: '2026-08', label: 'Август',  marginGoal: 9000,  tripsGoal: 42, milestone: '15 новых клиентов' },
  { ym: '2026-09', label: 'Сент.',   marginGoal: 9500,  tripsGoal: 45, milestone: '25 новых клиентов' },
  { ym: '2026-10', label: 'Октябрь', marginGoal: 10000, tripsGoal: 48, milestone: '35 новых клиентов' },
  { ym: '2026-11', label: 'Ноябрь',  marginGoal: 10000, tripsGoal: 50, milestone: '50 новых клиентов' },
];

const TOP_STAR_CLIENTS = ['Криспи Ритейл', 'БИМ текст'];
const BEST_ROUTE = 'Ульяновск–Минск';

const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTHS_FULL[parseInt(m, 10) - 1]} ${y}`;
};

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={s.pbTrack}>
      <View style={[s.pbFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

function MarginBadge({ pct }: { pct: number }) {
  const color = pct > 35 ? theme.colors.profit : pct >= 20 ? theme.colors.info : theme.colors.warning;
  return (
    <View style={[s.badge, { backgroundColor: color + '20' }]}>
      <Text style={[s.badgeTxt, { color }]}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

function GoalCard({ title, fact, goal, unit, onEditGoal, formatFn }: {
  title: string; fact: number; goal: number; unit: string;
  onEditGoal?: (newGoal: number) => void;
  formatFn?: (n: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(String(Math.round(goal)));

  useEffect(() => { setEditVal(String(Math.round(goal))); }, [goal]);

  const pct = goal > 0 ? Math.min(Math.round((fact / goal) * 100), 100) : 0;
  const done = pct >= 100;
  const fmt = formatFn || ((n: number) => String(Math.round(n)));
  const barColor = done ? theme.colors.profit : pct >= 80 ? theme.colors.warning : theme.colors.info;

  const confirmEdit = () => {
    const v = parseFloat(editVal.replace(',', '.'));
    if (!isNaN(v) && v > 0) onEditGoal?.(v);
    setEditing(false);
  };

  return (
    <View style={[s.goalCard, done && { borderColor: theme.colors.profit + '50' }]}>
      <View style={s.goalHeader}>
        <Text style={s.goalTitle} numberOfLines={2}>{title}</Text>
        <TouchableOpacity onPress={() => onEditGoal ? setEditing(true) : null} activeOpacity={onEditGoal ? 0.6 : 1} style={{ padding: 2 }}>
          {!!onEditGoal && <Pencil size={12} color={theme.colors.textTertiary} strokeWidth={1.8} />}
        </TouchableOpacity>
      </View>

      <Text style={[s.goalFact, { color: done ? theme.colors.profit : theme.colors.textPrimary }]}>
        {fmt(fact)}
      </Text>

      {editing ? (
        <View style={s.goalEditRow}>
          <TextInput
            style={s.goalEditInput}
            value={editVal}
            onChangeText={setEditVal}
            keyboardType="numeric"
            autoFocus
          />
          <TouchableOpacity onPress={confirmEdit} style={s.goalEditBtn} activeOpacity={0.7}>
            <Check size={14} color={theme.colors.profit} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditing(false)} style={s.goalEditBtn} activeOpacity={0.7}>
            <X size={14} color={theme.colors.loss} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.goalSubRow}>
          <Text style={s.goalSub}>из {fmt(goal)} {unit}</Text>
          <View style={[s.goalBadge, { backgroundColor: done ? theme.colors.profit + '20' : theme.colors.info + '20' }]}>
            <Text style={[s.goalBadgeTxt, { color: done ? theme.colors.profit : theme.colors.info }]}>
              {done ? 'выполнено' : 'в процессе'}
            </Text>
          </View>
        </View>
      )}

      <ProgressBar pct={pct} color={barColor} />
      <Text style={s.goalPct}>{pct}%</Text>
    </View>
  );
}

export default function AnalyticsTab() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentYM());
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [goalsData, setGoalsData] = useState<any>(null);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [editingRates, setEditingRates] = useState(false);
  const [draftRates, setDraftRates] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  const effectiveMonth = selectedPeriod === 'all' ? currentYM() : selectedPeriod;

  const loadSettings = useCallback(async () => {
    try {
      const s = await api.settings.get();
      setSettings(s);
    } catch {}
  }, []);

  const fetchData = useCallback(async (period: string) => {
    setLoading(true);
    try {
      const result = await api.analytics(period === 'all' ? undefined : period);
      setData(result);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const fetchGoals = useCallback(async (month: string) => {
    setGoalsLoading(true);
    try {
      const g = await api.goals.get(month);
      setGoalsData(g);
    } catch {
      setGoalsData(null);
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { fetchData(selectedPeriod); }, [selectedPeriod]);
  useEffect(() => { fetchGoals(effectiveMonth); }, [effectiveMonth]);

  const saveGoal = async (key: string, value: number) => {
    if (!goalsData) return;
    const updated = { ...goalsData, [key]: value };
    setGoalsData(updated);
    try {
      await api.goals.save({
        month: effectiveMonth,
        profit_goal: updated.profit_goal ?? 7000,
        trips_goal: updated.trips_goal ?? 45,
        margin_goal: updated.margin_goal ?? 230,
        new_clients_goal: updated.new_clients_goal ?? 9,
      });
    } catch {}
  };

  const startEditRates = () => {
    setDraftRates((settings?.rate_minimums || []).map((r: any) => ({ ...r })));
    setEditingRates(true);
  };

  const saveRates = async () => {
    setSavingSettings(true);
    try {
      await api.settings.update({ rate_minimums: draftRates });
      setSettings((prev: any) => ({ ...prev, rate_minimums: draftRates }));
      setEditingRates(false);
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить ставки');
    } finally { setSavingSettings(false); }
  };

  const monthly: any[] = data?.monthly || [];
  const availableMonths: string[] = monthly.map((m: any) => m.month);
  const periodLabel = selectedPeriod === 'all'
    ? 'За всё время'
    : `${MONTHS_SHORT[parseInt(selectedPeriod.slice(5, 7), 10) - 1]} ${selectedPeriod.slice(0, 4)}`;

  const summary = data?.summary || {};
  const clients: any[] = data?.clients || [];
  const routes: any[] = data?.routes || [];
  const lossTrips: any[] = data?.loss_trips || [];
  const totalLoss = lossTrips.reduce((acc: number, t: any) => acc + (t.loss || 0), 0);
  const monthlyMap: Record<string, any> = Object.fromEntries(monthly.map((m: any) => [m.month, m]));

  const rateMinimums: any[] = settings?.rate_minimums ?? [];

  if (loading && !data) {
    return <View style={s.loadingWrap}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  return (
    <View>
      {/* ── Период ─────────────────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll}
        contentContainerStyle={s.pillsContent}>
        {[{ id: 'all', label: 'Все время' }, ...availableMonths.slice().reverse().map(ym => ({
          id: ym,
          label: `${MONTHS_SHORT[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}`,
        }))].map(p => (
          <TouchableOpacity key={p.id} onPress={() => setSelectedPeriod(p.id)}
            style={[s.pill, selectedPeriod === p.id && s.pillActive]} activeOpacity={0.7}>
            <Text style={[s.pillTxt, selectedPeriod === p.id && s.pillTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginBottom: 8 }} />}

      {/* ── Цели месяца ────────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 8 }}>
        <Text style={s.sectionLabel}>
          {'ЦЕЛИ — ' + monthLabel(effectiveMonth).toUpperCase()}
        </Text>
        {goalsLoading && <ActivityIndicator size="small" color={theme.colors.accent} />}
      </View>
      <View style={s.goalGrid}>
        <GoalCard
          title="Прибыль месяца"
          fact={goalsData?.profit_fact ?? 0}
          goal={goalsData?.profit_goal ?? 7000}
          unit="BYN"
          formatFn={n => Math.round(n).toLocaleString('ru-RU')}
          onEditGoal={v => saveGoal('profit_goal', v)}
        />
        <GoalCard
          title="Новые клиенты"
          fact={goalsData?.new_clients_fact ?? 0}
          goal={goalsData?.new_clients_goal ?? 9}
          unit="план на мес."
          onEditGoal={v => saveGoal('new_clients_goal', v)}
        />
        <GoalCard
          title="Рейсов в месяц"
          fact={goalsData?.trips_fact ?? 0}
          goal={goalsData?.trips_goal ?? 45}
          unit="план"
          onEditGoal={v => saveGoal('trips_goal', v)}
        />
        <GoalCard
          title="Ср. прибыль / рейс"
          fact={goalsData?.margin_fact ?? 0}
          goal={goalsData?.margin_goal ?? 230}
          unit="BYN цель"
          formatFn={n => Math.round(n).toLocaleString('ru-RU')}
          onEditGoal={v => saveGoal('margin_goal', v)}
        />
      </View>

      {/* ── Финансовый итог ─────────────────────────────────────────────────── */}
      <SectionLabel>ФИНАНСОВЫЙ ИТОГ — {periodLabel.toUpperCase()}</SectionLabel>
      <View style={s.summaryGrid}>
        {[
          { label: 'ВЫРУЧКА',  value: formatShort(summary.revenue ?? 0),  sub: 'BYN от клиентов', color: undefined },
          { label: 'РАСХОДЫ',  value: formatShort(summary.expenses ?? 0), sub: 'BYN перевозчикам', color: theme.colors.loss },
          { label: 'МАРЖА',    value: formatShort(summary.margin ?? 0),   sub: 'BYN',
            color: (summary.margin ?? 0) >= 0 ? theme.colors.profit : theme.colors.loss },
          { label: 'МАРЖА %',  value: `${summary.margin_pct ?? 0}%`,      sub: `${summary.trips_count ?? 0} рейсов`,
            color: (summary.margin_pct ?? 0) >= 20 ? theme.colors.profit
              : (summary.margin_pct ?? 0) >= 10 ? theme.colors.warning : theme.colors.loss },
        ].map(c => (
          <View key={c.label} style={s.summaryCard}>
            <Text style={s.summaryLabel}>{c.label}</Text>
            <Text style={[s.summaryValue, c.color ? { color: c.color } : {}]}>{c.value}</Text>
            <Text style={s.summarySub}>{c.sub}</Text>
          </View>
        ))}
      </View>

      {/* ── Топ маршруты ───────────────────────────────────────────────────── */}
      {routes.length > 0 && (
        <>
          <SectionLabel>ТОП МАРШРУТЫ ПО МАРЖЕ</SectionLabel>
          <View style={s.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: '100%' }}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { flex: 1, minWidth: 160 }]}>Маршрут</Text>
                  <Text style={[s.th, s.thR, { width: 64 }]}>Рейсов</Text>
                  <Text style={[s.th, s.thR, { width: 110 }]}>Ср. маржа</Text>
                  <Text style={[s.th, s.thR, { width: 120 }]}>Итого маржа</Text>
                </View>
                {routes.map((r: any, i: number) => (
                  <View key={r.route} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                    <View style={{ flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.td} numberOfLines={1}>{r.route}</Text>
                      {r.route === BEST_ROUTE && (
                        <View style={s.goldBadge}><Text style={s.goldBadgeTxt}>★</Text></View>
                      )}
                    </View>
                    <Text style={[s.td, s.tdR, { width: 64 }]}>{r.trips}</Text>
                    <Text style={[s.td, s.tdR, { width: 110 }]}>{Math.round(r.avg_margin).toLocaleString('ru-RU')} Br</Text>
                    <Text style={[s.td, s.tdR, { width: 120, fontWeight: '700',
                      color: r.total_margin >= 0 ? theme.colors.profit : theme.colors.loss }]}>
                      {Math.round(r.total_margin).toLocaleString('ru-RU')} Br
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── Топ клиенты ────────────────────────────────────────────────────── */}
      {clients.length > 0 && (
        <>
          <SectionLabel>КЛИЕНТЫ ПО МАРЖИНАЛЬНОСТИ</SectionLabel>
          <View style={s.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: '100%' }}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { flex: 1, minWidth: 160 }]}>Клиент</Text>
                  <Text style={[s.th, s.thR, { width: 60 }]}>Рейсов</Text>
                  <Text style={[s.th, s.thR, { width: 100 }]}>Выручка</Text>
                  <Text style={[s.th, s.thR, { width: 100 }]}>Маржа</Text>
                  <Text style={[s.th, s.thR, { width: 72 }]}>%</Text>
                </View>
                {clients.map((c: any, i: number) => (
                  <View key={c.name} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                    <View style={{ flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={s.td} numberOfLines={1}>{c.name}</Text>
                      {TOP_STAR_CLIENTS.includes(c.name) && <Text style={{ color: theme.colors.warning, fontSize: 12 }}>★</Text>}
                    </View>
                    <Text style={[s.td, s.tdR, { width: 60 }]}>{c.trips}</Text>
                    <Text style={[s.td, s.tdR, { width: 100 }]}>{formatShort(c.revenue)} Br</Text>
                    <Text style={[s.td, s.tdR, { width: 100, fontWeight: '700',
                      color: c.margin >= 0 ? theme.colors.profit : theme.colors.loss }]}>
                      {formatShort(c.margin)} Br
                    </Text>
                    <View style={{ width: 72, alignItems: 'flex-end' }}>
                      <MarginBadge pct={c.margin_pct} />
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── Убыточные рейсы ────────────────────────────────────────────────── */}
      {lossTrips.length > 0 && (
        <>
          <Text style={s.lossTitle}>⚠ Убыточные рейсы — требуют внимания</Text>
          <Text style={s.lossSub}>Итого убыток: <Text style={s.lossTotal}>{Math.round(totalLoss).toLocaleString('ru-RU')} BYN</Text></Text>
          <View style={[s.card, { borderColor: theme.colors.loss + '40' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: '100%' }}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { width: 110 }]}>№ заявки</Text>
                  <Text style={[s.th, { flex: 1, minWidth: 140 }]}>Клиент</Text>
                  <Text style={[s.th, { width: 140 }]}>Маршрут</Text>
                  <Text style={[s.th, s.thR, { width: 90 }]}>Ст. кл.</Text>
                  <Text style={[s.th, s.thR, { width: 90 }]}>Ст. пер.</Text>
                  <Text style={[s.th, s.thR, { width: 80 }]}>Убыток</Text>
                </View>
                {lossTrips.map((t: any, i: number) => (
                  <View key={t.number || i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                    <Text style={[s.td, { width: 110, color: theme.colors.accent }]}>{t.number}</Text>
                    <Text style={[s.td, { flex: 1, minWidth: 140 }]} numberOfLines={1}>{t.client}</Text>
                    <Text style={[s.td, { width: 140 }]} numberOfLines={1}>{t.route}</Text>
                    <Text style={[s.td, s.tdR, { width: 90 }]}>{Math.round(t.client_rate).toLocaleString('ru-RU')} Br</Text>
                    <Text style={[s.td, s.tdR, { width: 90 }]}>{Math.round(t.carrier_rate).toLocaleString('ru-RU')} Br</Text>
                    <Text style={[s.td, s.tdR, { width: 80, color: theme.colors.loss, fontWeight: '800' }]}>
                      {Math.round(t.loss).toLocaleString('ru-RU')} Br
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── Бизнес-план ────────────────────────────────────────────────────── */}
      <SectionLabel>БИЗНЕС-ПЛАН ИЮНЬ–НОЯБРЬ 2026</SectionLabel>
      <View style={s.planGrid}>
        {PLAN_MONTHS.map(pm => {
          const actual = monthlyMap[pm.ym];
          const marginFact = actual?.margin ?? 0;
          const tripsFact = actual?.trips ?? 0;
          const curM = currentYM();
          const isPast = pm.ym < curM;
          const isCurrent = pm.ym === curM;
          const pct = pm.marginGoal > 0 ? Math.min(Math.round((marginFact / pm.marginGoal) * 100), 100) : 0;
          const status = isPast || isCurrent ? (pct >= 100 ? 'done' : 'active') : 'upcoming';
          const statusColor = status === 'done' ? theme.colors.profit : status === 'active' ? theme.colors.info : theme.colors.textTertiary;
          const statusLabel = status === 'done' ? 'Выполнено' : status === 'active' ? 'В процессе' : 'Предстоит';
          return (
            <View key={pm.ym} style={[s.planCard, status === 'done' && { borderColor: theme.colors.profit + '40' }]}>
              <View style={s.planTop}>
                <Text style={s.planMonth}>{pm.label}</Text>
                <View style={[s.badge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[s.badgeTxt, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={s.planGoal}>{pm.marginGoal.toLocaleString('ru-RU')} BYN · {pm.tripsGoal} рейсов</Text>
              {(isPast || isCurrent) && (
                <>
                  <Text style={[s.planFact, { color: statusColor }]}>
                    Факт: {Math.round(marginFact).toLocaleString('ru-RU')} BYN · {tripsFact} рейс.
                  </Text>
                  <ProgressBar pct={pct} color={statusColor} />
                  <Text style={[s.planPct, { color: statusColor }]}>{pct}%</Text>
                </>
              )}
              <Text style={s.planMilestone}>{pm.milestone}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Минимальные ставки ──────────────────────────────────────────────── */}
      <View style={s.rateHeader}>
        <View style={{ flex: 1 }}>
          <SectionLabel>МИНИМАЛЬНЫЕ СТАВКИ ПО МАРШРУТАМ</SectionLabel>
          <Text style={s.rateSubtitle}>Ниже порога — не брать без согласования</Text>
        </View>
        {!editingRates ? (
          <TouchableOpacity onPress={startEditRates} style={s.editBtn} activeOpacity={0.7}>
            <Pencil size={13} color={theme.colors.accent} strokeWidth={1.8} />
            <Text style={s.editBtnTxt}>Редактировать</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={saveRates} disabled={savingSettings}
              style={[s.editBtn, { backgroundColor: theme.colors.profit + '20', borderColor: theme.colors.profit + '40' }]} activeOpacity={0.7}>
              {savingSettings
                ? <ActivityIndicator size="small" color={theme.colors.profit} />
                : <Text style={[s.editBtnTxt, { color: theme.colors.profit }]}>Сохранить</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingRates(false)} style={s.editBtn} activeOpacity={0.7}>
              <Text style={[s.editBtnTxt, { color: theme.colors.loss }]}>Отмена</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[s.card, { marginBottom: 24 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: '100%' }}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 1, minWidth: 160 }]}>Маршрут</Text>
              <Text style={[s.th, s.thR, { width: 90 }]}>Ср. себест.</Text>
              <Text style={[s.th, s.thR, { width: 90 }]}>Мин. сейчас</Text>
              <Text style={[s.th, s.thR, { width: 100 }]}>Порог</Text>
              <Text style={[s.th, s.thR, { width: 130 }]}>Статус</Text>
            </View>
            {(editingRates ? draftRates : rateMinimums).map((rm: any, i: number) => {
              const isRed = rm.status === 'red';
              const badgeColor = isRed ? theme.colors.loss : theme.colors.warning;
              const badgeLabel = isRed ? 'Ввести немедленно' : 'Скорректировать';
              return (
                <View key={rm.route} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                  <Text style={[s.td, { flex: 1, minWidth: 160 }]}>{rm.route}</Text>
                  <Text style={[s.td, s.tdR, { width: 90 }]}>{rm.cost.toLocaleString('ru-RU')} Br</Text>
                  {editingRates ? (
                    <TextInput
                      style={[s.td, s.tdR, s.inlineInput, { width: 90 }]}
                      value={String(rm.current)}
                      keyboardType="numeric"
                      onChangeText={v => {
                        setDraftRates(prev => prev.map((r, idx) =>
                          idx === i ? { ...r, current: parseFloat(v) || 0 } : r));
                      }}
                    />
                  ) : (
                    <Text style={[s.td, s.tdR, { width: 90, color: rm.current === 0 ? theme.colors.loss : theme.colors.textPrimary }]}>
                      {rm.current === 0 ? '—' : `${rm.current.toLocaleString('ru-RU')} Br`}
                    </Text>
                  )}
                  {editingRates ? (
                    <TextInput
                      style={[s.td, s.tdR, s.inlineInput, { width: 100, color: theme.colors.accent }]}
                      value={String(rm.threshold)}
                      keyboardType="numeric"
                      onChangeText={v => {
                        const threshold = parseFloat(v) || 0;
                        setDraftRates(prev => prev.map((r, idx) =>
                          idx === i ? { ...r, threshold, status: r.current >= threshold ? 'yellow' : 'red' } : r));
                      }}
                    />
                  ) : (
                    <Text style={[s.td, s.tdR, { width: 100, fontWeight: '700', color: theme.colors.accent }]}>
                      {rm.threshold.toLocaleString('ru-RU')} Br
                    </Text>
                  )}
                  <View style={{ width: 130, alignItems: 'flex-end' }}>
                    <View style={[s.badge, { backgroundColor: badgeColor + '20' }]}>
                      <Text style={[s.badgeTxt, { color: badgeColor }]}>{badgeLabel}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },

  pillsScroll: { marginBottom: 14 },
  pillsContent: { gap: 8, paddingVertical: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999 },
  pillActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  pillTxt: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTxtActive: { color: theme.colors.accent },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 10, marginTop: 8 },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  goalCard: { width: '48%', flexGrow: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 4 },
  goalTitle: { color: theme.colors.textTertiary, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, flex: 1 },
  goalBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  goalBadgeTxt: { fontSize: 9, fontWeight: '700' },
  goalFact: { fontSize: 26, fontWeight: '800', letterSpacing: -1, color: theme.colors.textPrimary },
  goalSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, marginBottom: 10 },
  goalSub: { fontSize: 10, color: theme.colors.textTertiary, flex: 1 },
  goalEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 10 },
  goalEditInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: theme.colors.textPrimary, fontSize: 13, fontWeight: '700' },
  goalEditBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  goalPct: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 4, textAlign: 'right' },

  pbTrack: { height: 4, backgroundColor: theme.colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  pbFill: { height: '100%', borderRadius: 2 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryCard: { width: '48%', flexGrow: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14 },
  summaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: theme.colors.textTertiary },
  summaryValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.textPrimary, marginTop: 6 },
  summarySub: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 3 },

  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  th: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.textTertiary },
  thR: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 11, alignItems: 'center' },
  tableRowAlt: { backgroundColor: theme.colors.surfaceElevated },
  td: { fontSize: 12, color: theme.colors.textPrimary, fontWeight: '500' },
  tdR: { textAlign: 'right' },
  inlineInput: { borderWidth: 1, borderColor: theme.colors.accent + '60', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceElevated },

  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  goldBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: (theme.colors as any).accentBright + '25' },
  goldBadgeTxt: { color: (theme.colors as any).accentBright, fontSize: 10, fontWeight: '700' },

  lossTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.loss, marginBottom: 4, marginTop: 8 },
  lossSub: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 10 },
  lossTotal: { fontWeight: '800', color: theme.colors.loss },

  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  planCard: { width: '48%', flexGrow: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  planMonth: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  planGoal: { fontSize: 10, color: theme.colors.textTertiary, marginBottom: 6 },
  planFact: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  planPct: { fontSize: 10, fontWeight: '700', textAlign: 'right', marginTop: 3 },
  planMilestone: { fontSize: 10, color: theme.colors.accent, fontWeight: '600', marginTop: 6 },

  rateHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 0 },
  rateSubtitle: { fontSize: 11, color: theme.colors.textTertiary, marginBottom: 10 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.accent + '15', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.accent + '40', marginBottom: 10 },
  editBtnTxt: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
});
