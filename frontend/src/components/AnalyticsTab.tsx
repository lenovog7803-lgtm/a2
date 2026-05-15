import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { theme, formatMoney, formatShort } from '../theme';
import { api } from '../api';

// ─── Static plan data ─────────────────────────────────────────────────────────
const PLAN_MONTHS = [
  { ym: '2026-06', label: 'Июнь',   marginGoal: 7500,  tripsGoal: 35, milestone: 'Старт outbound' },
  { ym: '2026-07', label: 'Июль',   marginGoal: 8500,  tripsGoal: 40, milestone: 'Пик сезона' },
  { ym: '2026-08', label: 'Август', marginGoal: 9000,  tripsGoal: 42, milestone: '15 новых клиентов' },
  { ym: '2026-09', label: 'Сентябрь',marginGoal: 9500, tripsGoal: 45, milestone: '25 новых клиентов' },
  { ym: '2026-10', label: 'Октябрь',marginGoal: 10000, tripsGoal: 48, milestone: '35 новых клиентов' },
  { ym: '2026-11', label: 'Ноябрь', marginGoal: 10000, tripsGoal: 50, milestone: '50 новых клиентов' },
];

const RATE_MINIMUMS = [
  { route: 'Москва↔Минск',       cost: 720,  current: 50,  threshold: 865,  status: 'red' },
  { route: 'СПб↔Минск',          cost: 406,  current: 75,  threshold: 487,  status: 'red' },
  { route: 'Минск↔Москва',       cost: 492,  current: 150, threshold: 590,  status: 'red' },
  { route: 'Жодино↔Москва',      cost: 543,  current: 250, threshold: 651,  status: 'yellow' },
  { route: 'Ульяновск–Минск',    cost: 1328, current: 900, threshold: 1594, status: 'yellow' },
  { route: 'Минск–Минск (лок.)', cost: 130,  current: 0,   threshold: 200,  status: 'red' },
  { route: 'Смоленск–Минск',     cost: 335,  current: 160, threshold: 402,  status: 'yellow' },
];

const TOP_STAR_CLIENTS = ['Криспи Ритейл', 'БИМ текст'];
const BEST_ROUTE = 'Ульяновск–Минск';

const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ─── Progress bar helper ────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(pct, 100);
  return (
    <View style={s.pbTrack}>
      <View style={[s.pbFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── Goal card ─────────────────────────────────────────────────────────────────
function GoalCard({ title, fact, goal, unit, extra, formatFn }: {
  title: string; fact: number; goal: number; unit: string; extra?: string;
  formatFn?: (n: number) => string;
}) {
  const pct = goal > 0 ? Math.min(Math.round((fact / goal) * 100), 100) : 0;
  const done = pct >= 100;
  const fmt = formatFn || ((n: number) => String(Math.round(n)));
  const barColor = done
    ? theme.colors.profit
    : pct >= 80
      ? theme.colors.warning
      : theme.colors.info;

  return (
    <View style={[s.goalCard, done && { borderColor: theme.colors.profit + '40' }]}>
      <View style={s.goalHeader}>
        <Text style={s.goalTitle}>{title}</Text>
        <View style={[s.goalBadge, { backgroundColor: done ? theme.colors.profit + '20' : theme.colors.info + '20' }]}>
          <Text style={[s.goalBadgeTxt, { color: done ? theme.colors.profit : theme.colors.info }]}>
            {done ? 'выполнено' : 'в процессе'}
          </Text>
        </View>
      </View>
      <Text style={[s.goalFact, { color: done ? theme.colors.profit : theme.colors.textPrimary }]}>
        {fmt(fact)}
      </Text>
      <Text style={s.goalSub}>из {fmt(goal)} {unit}</Text>
      <ProgressBar pct={pct} color={barColor} />
      <Text style={s.goalPct}>{pct}%</Text>
      {!!extra && <Text style={s.goalExtra}>{extra}</Text>}
    </View>
  );
}

// ─── Section label ──────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

// ─── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <View style={s.summaryCard}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, color ? { color } : {}]}>{value}</Text>
      <Text style={s.summarySub}>{sub}</Text>
    </View>
  );
}

// ─── Margin badge ───────────────────────────────────────────────────────────────
function MarginBadge({ pct }: { pct: number }) {
  const color = pct > 35 ? theme.colors.profit : pct >= 20 ? theme.colors.info : theme.colors.warning;
  return (
    <View style={[s.badge, { backgroundColor: color + '20' }]}>
      <Text style={[s.badgeTxt, { color }]}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function AnalyticsTab() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (period: string) => {
    setLoading(true);
    try {
      const result = await api.analytics(period === 'all' ? undefined : period);
      setData(result);
    } catch (e) {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(selectedPeriod); }, [selectedPeriod]);

  const monthly: any[] = data?.monthly || [];
  const availableMonths: string[] = monthly.map((m: any) => m.month);

  const periodLabel = selectedPeriod === 'all'
    ? 'За всё время'
    : (() => {
        const idx = parseInt(selectedPeriod.slice(5, 7), 10) - 1;
        return `${MONTHS_SHORT[idx]} ${selectedPeriod.slice(0, 4)}`;
      })();

  const summary = data?.summary || {};
  const goals = data?.goals || {};
  const clients: any[] = data?.clients || [];
  const routes: any[] = data?.routes || [];
  const lossTrips: any[] = data?.loss_trips || [];

  const totalLoss = lossTrips.reduce((acc: number, t: any) => acc + (t.loss || 0), 0);

  // Plan actuals from monthly data
  const monthlyMap: Record<string, any> = Object.fromEntries(monthly.map((m: any) => [m.month, m]));

  if (loading && !data) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View>
      {/* ── СЕКЦИЯ 1: Переключатель периода ────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll}
        contentContainerStyle={s.pillsContent}>
        {[{ id: 'all', label: 'Все время' }, ...availableMonths.slice().reverse().map(ym => {
          const idx = parseInt(ym.slice(5, 7), 10) - 1;
          return { id: ym, label: `${MONTHS_SHORT[idx]} ${ym.slice(0, 4)}` };
        })].map(p => {
          const active = selectedPeriod === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelectedPeriod(p.id)}
              style={[s.pill, active && s.pillActive]}
              activeOpacity={0.7}
            >
              <Text style={[s.pillTxt, active && s.pillTxtActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      )}

      {/* ── СЕКЦИЯ 2: Карточки целей (текущий месяц) ───────────────────────── */}
      <SectionLabel>ЦЕЛИ ТЕКУЩЕГО МЕСЯЦА</SectionLabel>
      <View style={s.goalGrid}>
        <GoalCard
          title="Прибыль месяца"
          fact={goals.margin_fact || 0}
          goal={goals.margin_goal || 10000}
          unit="BYN"
          formatFn={n => Math.round(n).toLocaleString('ru-RU')}
        />
        <GoalCard
          title="Новые клиенты"
          fact={goals.new_clients_fact || 0}
          goal={goals.new_clients_goal || 9}
          unit="план на мес."
        />
        <GoalCard
          title="Рейсов в месяц"
          fact={goals.trips_fact || 0}
          goal={goals.trips_goal || 45}
          unit="план"
        />
        <GoalCard
          title="Ср. маржа / рейс"
          fact={goals.avg_margin_fact || 0}
          goal={goals.avg_margin_goal || 230}
          unit="BYN цель"
          formatFn={n => Math.round(n).toLocaleString('ru-RU')}
        />
      </View>

      {/* ── СЕКЦИЯ 3: Сводные метрики ───────────────────────────────────────── */}
      <SectionLabel>ФИНАНСОВЫЙ ИТОГ — {periodLabel.toUpperCase()}</SectionLabel>
      <View style={s.summaryGrid}>
        <SummaryCard
          label="ВЫРУЧКА"
          value={formatShort(summary.revenue || 0)}
          sub="BYN от клиентов"
        />
        <SummaryCard
          label="РАСХОДЫ"
          value={formatShort(summary.expenses || 0)}
          sub="BYN перевозчикам"
          color={theme.colors.loss}
        />
        <SummaryCard
          label="МАРЖА"
          value={formatShort(summary.margin || 0)}
          sub="BYN"
          color={(summary.margin || 0) >= 0 ? theme.colors.profit : theme.colors.loss}
        />
        <SummaryCard
          label="МАРЖА %"
          value={`${summary.margin_pct || 0}%`}
          sub={`${summary.trips_count || 0} рейсов`}
          color={(summary.margin_pct || 0) >= 20 ? theme.colors.profit
            : (summary.margin_pct || 0) >= 10 ? theme.colors.warning : theme.colors.loss}
        />
      </View>

      {/* ── СЕКЦИЯ 4: Топ маршруты ─────────────────────────────────────────── */}
      {routes.length > 0 && (
        <>
          <SectionLabel>ТОП МАРШРУТЫ ПО МАРЖЕ</SectionLabel>
          <View style={s.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { width: 160 }]}>Маршрут</Text>
                  <Text style={[s.th, s.thRight, { width: 64 }]}>Рейсов</Text>
                  <Text style={[s.th, s.thRight, { width: 100 }]}>Ср. маржа</Text>
                  <Text style={[s.th, s.thRight, { width: 110 }]}>Итого маржа</Text>
                </View>
                {routes.map((r: any, i: number) => (
                  <View key={r.route} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                    <View style={{ width: 160, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.td} numberOfLines={1}>{r.route}</Text>
                      {r.route === BEST_ROUTE && (
                        <View style={s.goldBadge}>
                          <Text style={s.goldBadgeTxt}>★</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.td, s.tdRight, { width: 64 }]}>{r.trips}</Text>
                    <Text style={[s.td, s.tdRight, { width: 100 }]}>
                      {Math.round(r.avg_margin).toLocaleString('ru-RU')} Br
                    </Text>
                    <Text style={[s.td, s.tdRight, { width: 110, color: r.total_margin >= 0 ? theme.colors.profit : theme.colors.loss, fontWeight: '700' }]}>
                      {Math.round(r.total_margin).toLocaleString('ru-RU')} Br
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── СЕКЦИЯ 5: Топ клиенты ──────────────────────────────────────────── */}
      {clients.length > 0 && (
        <>
          <SectionLabel>КЛИЕНТЫ ПО МАРЖИНАЛЬНОСТИ</SectionLabel>
          <View style={s.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { width: 160 }]}>Клиент</Text>
                  <Text style={[s.th, s.thRight, { width: 60 }]}>Рейсов</Text>
                  <Text style={[s.th, s.thRight, { width: 100 }]}>Выручка</Text>
                  <Text style={[s.th, s.thRight, { width: 100 }]}>Маржа</Text>
                  <Text style={[s.th, s.thRight, { width: 72 }]}>Маржа %</Text>
                </View>
                {clients.map((c: any, i: number) => (
                  <View key={c.name} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                    <View style={{ width: 160, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={s.td} numberOfLines={1}>{c.name}</Text>
                      {TOP_STAR_CLIENTS.includes(c.name) && (
                        <Text style={{ color: theme.colors.warning, fontSize: 12 }}>★</Text>
                      )}
                    </View>
                    <Text style={[s.td, s.tdRight, { width: 60 }]}>{c.trips}</Text>
                    <Text style={[s.td, s.tdRight, { width: 100 }]}>
                      {formatShort(c.revenue)} Br
                    </Text>
                    <Text style={[s.td, s.tdRight, { width: 100, color: c.margin >= 0 ? theme.colors.profit : theme.colors.loss, fontWeight: '700' }]}>
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

      {/* ── СЕКЦИЯ 6: Убыточные рейсы ──────────────────────────────────────── */}
      {lossTrips.length > 0 && (
        <>
          <Text style={s.lossTitle}>⚠ Убыточные рейсы — требуют внимания</Text>
          <Text style={s.lossSub}>
            Итого убыток:{' '}
            <Text style={s.lossTotal}>{Math.round(totalLoss).toLocaleString('ru-RU')} BYN</Text>
          </Text>
          <View style={[s.card, { borderColor: theme.colors.loss + '40' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { width: 110 }]}>№ заявки</Text>
                  <Text style={[s.th, { width: 140 }]}>Клиент</Text>
                  <Text style={[s.th, { width: 140 }]}>Маршрут</Text>
                  <Text style={[s.th, s.thRight, { width: 90 }]}>Ст. кл.</Text>
                  <Text style={[s.th, s.thRight, { width: 90 }]}>Ст. пер.</Text>
                  <Text style={[s.th, s.thRight, { width: 80 }]}>Убыток</Text>
                </View>
                {lossTrips.map((t: any, i: number) => (
                  <View key={t.number || i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                    <Text style={[s.td, { width: 110, color: theme.colors.accent }]}>{t.number}</Text>
                    <Text style={[s.td, { width: 140 }]} numberOfLines={1}>{t.client}</Text>
                    <Text style={[s.td, { width: 140 }]} numberOfLines={1}>{t.route}</Text>
                    <Text style={[s.td, s.tdRight, { width: 90 }]}>
                      {Math.round(t.client_rate).toLocaleString('ru-RU')} Br
                    </Text>
                    <Text style={[s.td, s.tdRight, { width: 90 }]}>
                      {Math.round(t.carrier_rate).toLocaleString('ru-RU')} Br
                    </Text>
                    <Text style={[s.td, s.tdRight, { width: 80, color: theme.colors.loss, fontWeight: '800' }]}>
                      {Math.round(t.loss).toLocaleString('ru-RU')} Br
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* ── СЕКЦИЯ 7: План на 6 месяцев ────────────────────────────────────── */}
      <SectionLabel>БИЗНЕС-ПЛАН ИЮНЬ–НОЯБРЬ 2026</SectionLabel>
      <View style={s.planGrid}>
        {PLAN_MONTHS.map(pm => {
          const actual = monthlyMap[pm.ym];
          const marginFact = actual?.margin || 0;
          const tripsFact = actual?.trips || 0;
          const curM = currentYM();
          const isPast = pm.ym < curM;
          const isCurrent = pm.ym === curM;
          const pct = pm.marginGoal > 0 ? Math.min(Math.round((marginFact / pm.marginGoal) * 100), 100) : 0;
          const status = isPast || isCurrent
            ? (pct >= 100 ? 'done' : 'active')
            : 'upcoming';
          const statusColor = status === 'done' ? theme.colors.profit
            : status === 'active' ? theme.colors.info
            : theme.colors.textTertiary;
          const statusLabel = status === 'done' ? 'Выполнено'
            : status === 'active' ? 'В процессе'
            : 'Предстоит';

          return (
            <View key={pm.ym} style={[s.planCard, status === 'done' && { borderColor: theme.colors.profit + '40' }]}>
              <View style={s.planTop}>
                <Text style={s.planMonth}>{pm.label}</Text>
                <View style={[s.planBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[s.planBadgeTxt, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={s.planGoal}>
                Цель: {pm.marginGoal.toLocaleString('ru-RU')} BYN · {pm.tripsGoal} рейсов
              </Text>
              {(isPast || isCurrent) && (
                <>
                  <Text style={[s.planFact, { color: statusColor }]}>
                    Факт: {Math.round(marginFact).toLocaleString('ru-RU')} BYN · {tripsFact} рейсов
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

      {/* ── СЕКЦИЯ 8: Минимальные ставки ───────────────────────────────────── */}
      <SectionLabel>МИНИМАЛЬНЫЕ СТАВКИ КЛИЕНТА ПО МАРШРУТАМ</SectionLabel>
      <Text style={s.rateSubtitle}>Рейс ниже порога — не принимать без согласования</Text>
      <View style={[s.card, { marginBottom: 24 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: 160 }]}>Маршрут</Text>
              <Text style={[s.th, s.thRight, { width: 90 }]}>Ср. себест.</Text>
              <Text style={[s.th, s.thRight, { width: 90 }]}>Мин. сейчас</Text>
              <Text style={[s.th, s.thRight, { width: 90 }]}>Порог</Text>
              <Text style={[s.th, s.thRight, { width: 130 }]}>Статус</Text>
            </View>
            {RATE_MINIMUMS.map((rm, i) => {
              const isRed = rm.status === 'red';
              const badgeColor = isRed ? theme.colors.loss : theme.colors.warning;
              const badgeLabel = isRed ? 'Ввести немедленно' : 'Скорректировать';
              return (
                <View key={rm.route} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                  <Text style={[s.td, { width: 160 }]}>{rm.route}</Text>
                  <Text style={[s.td, s.tdRight, { width: 90 }]}>
                    {rm.cost.toLocaleString('ru-RU')} Br
                  </Text>
                  <Text style={[s.td, s.tdRight, { width: 90, color: rm.current === 0 ? theme.colors.loss : theme.colors.textPrimary }]}>
                    {rm.current === 0 ? '—' : `${rm.current.toLocaleString('ru-RU')} Br`}
                  </Text>
                  <Text style={[s.td, s.tdRight, { width: 90, fontWeight: '700', color: theme.colors.accent }]}>
                    {rm.threshold.toLocaleString('ru-RU')} Br
                  </Text>
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

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },

  // Period pills
  pillsScroll: { marginBottom: 14 },
  pillsContent: { gap: 8, paddingVertical: 4 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 999,
  },
  pillActive: { backgroundColor: theme.colors.accent + '20', borderColor: theme.colors.accent },
  pillTxt: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTxtActive: { color: theme.colors.accent },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.8,
    color: theme.colors.textTertiary, marginBottom: 10, marginTop: 8,
  },

  // Goal cards
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  goalCard: {
    width: '48%', flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, padding: 14,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  goalTitle: { color: theme.colors.textTertiary, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, flex: 1 },
  goalBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  goalBadgeTxt: { fontSize: 9, fontWeight: '700' },
  goalFact: { fontSize: 28, fontWeight: '800', letterSpacing: -1, color: theme.colors.textPrimary },
  goalSub: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 2, marginBottom: 10 },
  goalPct: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 4, textAlign: 'right' },
  goalExtra: { fontSize: 10, color: theme.colors.info, marginTop: 4 },

  // Progress bar
  pbTrack: { height: 4, backgroundColor: theme.colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  pbFill: { height: '100%', borderRadius: 2 },

  // Summary grid
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryCard: {
    width: '48%', flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, padding: 14,
  },
  summaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: theme.colors.textTertiary },
  summaryValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.textPrimary, marginTop: 6 },
  summarySub: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 3 },

  // Card wrapper (for tables)
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, marginBottom: 16, overflow: 'hidden',
  },

  // Table
  tableHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  th: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.textTertiary },
  thRight: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 11, alignItems: 'center' },
  tableRowAlt: { backgroundColor: theme.colors.surfaceElevated },
  td: { fontSize: 12, color: theme.colors.textPrimary, fontWeight: '500' },
  tdRight: { textAlign: 'right' },

  // Badges
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  goldBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: theme.colors.accentBright + '25' },
  goldBadgeTxt: { color: theme.colors.accentBright, fontSize: 10, fontWeight: '700' },

  // Loss section
  lossTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.loss, marginBottom: 4, marginTop: 8 },
  lossSub: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 10 },
  lossTotal: { fontWeight: '800', color: theme.colors.loss },

  // Plan grid
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  planCard: {
    width: '48%', flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, padding: 14,
  },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  planMonth: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  planBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  planBadgeTxt: { fontSize: 9, fontWeight: '700' },
  planGoal: { fontSize: 10, color: theme.colors.textTertiary, marginBottom: 6 },
  planFact: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  planPct: { fontSize: 10, fontWeight: '700', textAlign: 'right', marginTop: 3 },
  planMilestone: { fontSize: 10, color: theme.colors.accent, fontWeight: '600', marginTop: 6 },

  // Rate minimums
  rateSubtitle: { fontSize: 11, color: theme.colors.textTertiary, marginBottom: 10, marginTop: -6 },
});
