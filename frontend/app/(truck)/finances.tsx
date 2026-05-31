import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const PERIODS = [
  { key: 'current', label: 'Текущий месяц' },
  { key: 'previous', label: 'Прошлый месяц' },
  { key: 'all', label: 'Всё время' },
];

const SETTINGS_FIELDS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: 'base_rent', label: 'Базовая аренда', suffix: 'BYN' },
  { key: 'base_rate_threshold', label: 'Порог ставки для бонуса', suffix: 'BYN' },
  { key: 'bonus_split_pct', label: 'Раздел бонуса (инвестор)', suffix: '%' },
  { key: 'driver_fix_salary', label: 'Оклад водителя', suffix: 'BYN/мес' },
  { key: 'driver_per_trip', label: 'Водитель за рейс', suffix: 'BYN' },
  { key: 'fszn_pct', label: 'ФСЗН', suffix: '%' },
  { key: 'to_kasko_monthly', label: 'ТО + КАСКО', suffix: 'BYN/мес' },
  { key: 'fuel_rate_per_100km', label: 'Расход топлива', suffix: 'л/100 км' },
  { key: 'fuel_price_per_liter', label: 'Цена топлива', suffix: 'BYN/л' },
  { key: 'tax_ip_pct', label: 'Налог ИП', suffix: '%' },
  { key: 'mgr_fix', label: 'Оклад менеджера', suffix: 'BYN/мес' },
  { key: 'mgr_pct', label: 'Процент менеджера', suffix: '%' },
  { key: 'mgr_fszn_pct', label: 'ФСЗН менеджера', suffix: '%' },
  { key: 'machine_cost', label: 'Стоимость машины', suffix: 'BYN' },
  { key: 'investor_company_name', label: 'Название компании инвестора', suffix: '' },
];

export default function TruckFinances() {
  const [tab, setTab] = useState<'settings' | 'analytics'>('analytics');
  const [period, setPeriod] = useState('current');
  const [settings, setSettings] = useState<any>({});
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, a] = await Promise.all([
        api.truck.financials.get(),
        api.truck.analytics(period),
      ]);
      setSettings(s);
      setAnalytics(a);
    } catch {}
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [period]));

  const save = async () => {
    setSaving(true);
    try {
      await api.truck.financials.update(settings);
      Alert.alert('Сохранено');
    } catch { Alert.alert('Ошибка сохранения'); }
    setSaving(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Финансы машины</Text>

      <View style={styles.tabRow}>
        {(['analytics', 'settings'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'analytics' ? 'Аналитика' : 'Настройки'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'settings' ? (
        <View>
          {SETTINGS_FIELDS.map(f => (
            <View key={f.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <View style={styles.fieldInput}>
                <TextInput
                  style={styles.input}
                  value={String(settings[f.key] ?? '')}
                  onChangeText={v => setSettings((s: any) => ({ ...s, [f.key]: isNaN(Number(v)) ? v : (v === '' ? '' : Number(v)) }))}
                  keyboardType={f.suffix && f.suffix !== '' && f.key !== 'investor_company_name' ? 'numeric' : 'default'}
                  placeholderTextColor={theme.colors.textTertiary}
                />
                {f.suffix ? <Text style={styles.suffix}>{f.suffix}</Text> : null}
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Сохранение...' : 'Сохранить настройки'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity key={p.key} style={[styles.periodBtn, period === p.key && styles.periodBtnActive]} onPress={() => setPeriod(p.key)}>
                <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <AnalyticsBlock title="Блок ИП (Экспедирование)" color={theme.colors.info}>
            <Row label="Выручка" value={formatMoney(analytics?.revenue ?? 0)} />
            <Row label="Аренда инвестору" value={`− ${formatMoney(analytics?.investor_total ?? 0)}`} negative />
            <Row label="Маржа ИП" value={formatMoney(analytics?.margin_ip ?? 0)} bold />
            <Row label={`Налог ${settings.tax_ip_pct ?? 20}%`} value={`− ${formatMoney(analytics?.tax ?? 0)}`} negative />
            <Row label="Чистая мне" value={formatMoney(analytics?.net_ip ?? 0)} bold accent />
          </AnalyticsBlock>

          <AnalyticsBlock title="Блок инвестора" color={theme.colors.accent}>
            <Row label="Аренда" value={formatMoney(analytics?.investor_total ?? 0)} />
            <Row label="Топливо" value={`− ${formatMoney(analytics?.fuel_total ?? 0)}`} negative />
            <Row label="Водитель" value={`− ${formatMoney(analytics?.driver_salary_total ?? 0)}`} negative />
            <Row label="ФСЗН" value={`− ${formatMoney(analytics?.fszn ?? 0)}`} negative />
            <Row label="ТО/КАСКО" value={`− ${formatMoney(analytics?.to_kasko ?? 0)}`} negative />
            <Row label="Чистая инвестору" value={formatMoney(analytics?.investor_net ?? 0)} bold accent />
          </AnalyticsBlock>

          {(analytics?.unpaid_trips ?? []).length > 0 && (
            <AnalyticsBlock title="Долги инвестору" color={theme.colors.loss}>
              {(analytics.unpaid_trips as any[]).map((t: any) => (
                <Row key={t.id} label={`${t.trip_number} ${t.route || ''}`} value={formatMoney(t.rate_investor)} negative />
              ))}
              <Row label="Итого долг" value={formatMoney(analytics?.debt_to_investor ?? 0)} bold negative />
            </AnalyticsBlock>
          )}

          <AnalyticsBlock title="Окупаемость машины" color={theme.colors.warning}>
            <Row label="Стоимость машины" value={formatMoney(settings.machine_cost ?? 89000)} />
            <Row label="Прошло месяцев" value={String(analytics?.payback_months_elapsed ?? 0)} />
            <Row label="Расчётный срок" value={`${analytics?.payback_months_total ?? 0} мес.`} bold />
          </AnalyticsBlock>
        </View>
      )}
    </ScrollView>
  );
}

function AnalyticsBlock({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <View style={[aStyles.block, { borderLeftColor: color }]}>
      <Text style={aStyles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, bold, accent, negative }: { label: string; value: string; bold?: boolean; accent?: boolean; negative?: boolean }) {
  return (
    <View style={aStyles.row}>
      <Text style={aStyles.rowLabel}>{label}</Text>
      <Text style={[aStyles.rowValue, bold && aStyles.bold, accent && { color: theme.colors.accent }, negative && { color: theme.colors.loss }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 16, marginTop: 8 },
  tabRow: { flexDirection: 'row', backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, padding: 3, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: theme.colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: '#000' },
  periodRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 16 },
  periodBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border,
  },
  periodBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  periodText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  periodTextActive: { color: '#000' },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, paddingVertical: 10 },
  suffix: { fontSize: 12, color: theme.colors.textTertiary, marginLeft: 8 },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});

const aStyles = StyleSheet.create({
  block: {
    backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 3,
  },
  blockTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary },
  rowValue: { fontSize: 13, color: theme.colors.textPrimary },
  bold: { fontWeight: '700' },
});
