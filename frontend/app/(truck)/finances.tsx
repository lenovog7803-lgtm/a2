import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Truck } from 'lucide-react-native';
import { theme, formatMoney } from '../../src/theme';
import { api } from '../../src/api';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(ym: string) {
  if (!ym || ym === 'all') return 'Всё время';
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

const FIN_FIELDS: Array<{ key: string; label: string; suffix: string }> = [
  { key: 'base_rent', label: 'Базовая аренда', suffix: 'BYN' },
  { key: 'base_rate_threshold', label: 'Порог ставки для бонуса', suffix: 'BYN' },
  { key: 'bonus_split_pct', label: 'Доля бонуса инвестору', suffix: '%' },
  { key: 'fuel_rate_per_100km', label: 'Расход топлива', suffix: 'л/100 км' },
  { key: 'fuel_price_per_liter', label: 'Цена топлива', suffix: 'BYN/л' },
  { key: 'tax_ip_pct', label: 'Налог ИП', suffix: '%' },
  { key: 'machine_cost', label: 'Стоимость машины', suffix: 'BYN' },
  { key: 'investor_company_name', label: 'Компания инвестора', suffix: '' },
];

type Tab = 'analytics' | 'settings' | 'trucks';

export default function TruckFinances() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('analytics');
  const [period, setPeriod] = useState(currentMonth());
  const [settings, setSettings] = useState<any>({});
  const [analytics, setAnalytics] = useState<any>(null);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, a, tr] = await Promise.all([
        api.truck.financials.get(),
        api.truck.analytics(period),
        api.truck.trucks.list(),
      ]);
      setSettings(s);
      setAnalytics(a);
      setTrucks(tr as any[]);
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

  const deleteTruck = (t: any) => {
    Alert.alert('Удалить машину?', t.name, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await api.truck.trucks.remove(t.id);
        setTrucks(prev => prev.filter(x => x.id !== t.id));
      }},
    ]);
  };

  const cm = currentMonth();
  const availMonths: string[] = analytics?.available_months ?? [];

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>ФИНАНСЫ</Text>
          <Text style={styles.title}>Машина</Text>
        </View>
        {tab === 'trucks' && (
          <TouchableOpacity style={styles.fab} onPress={() => router.push('/truck-truck/new')}>
            <Plus size={20} color="#000" strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabRow}>
        {(['analytics', 'settings', 'trucks'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'analytics' ? 'Аналитика' : t === 'settings' ? 'Настройки' : 'Машины'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'analytics' && (
          <>
            {/* Month picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
              {[
                { id: cm, label: `${monthLabel(cm)}` },
                ...availMonths.filter(m => m !== cm).map(m => ({ id: m, label: monthLabel(m) })),
                { id: 'all', label: 'Всё время' },
              ].map(it => {
                const a = period === it.id;
                return (
                  <TouchableOpacity key={it.id} onPress={() => setPeriod(it.id)} style={[styles.chip, a && styles.chipActive]}>
                    <Text style={[styles.chipText, a && styles.chipTextActive]}>{it.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ABlock title="Итого за период" color={theme.colors.accent}>
              <ARow label="Рейсов" value={String(analytics?.trips_count ?? 0)} />
              <ARow label="Заявок" value={String(analytics?.orders_count ?? 0)} />
            </ABlock>

            <ABlock title="Блок ИП" color={theme.colors.info}>
              <ARow label="Выручка (ставки клиентов)" value={formatMoney(analytics?.revenue ?? 0)} />
              <ARow label="Аренда инвестору" value={`− ${formatMoney(analytics?.investor_total ?? 0)}`} neg />
              <ARow label="Бонусы инвестору" value={`− ${formatMoney(analytics?.bonus_total ?? 0)}`} neg />
              <ARow label="Маржа ИП" value={formatMoney(analytics?.margin_ip ?? 0)} bold />
              <ARow label={`Налог ${settings.tax_ip_pct ?? 20}%`} value={`− ${formatMoney(analytics?.tax ?? 0)}`} neg />
              <ARow label="Чистая мне" value={formatMoney(analytics?.net_ip ?? 0)} bold accent />
            </ABlock>

            <ABlock title="Блок инвестора" color={theme.colors.accent}>
              <ARow label="Аренда" value={formatMoney(analytics?.investor_total ?? 0)} />
              <ARow label="Топливо" value={`− ${formatMoney(analytics?.fuel_total ?? 0)}`} neg />
              <ARow label="Бонусы инвестору" value={`+ ${formatMoney(analytics?.bonus_total ?? 0)}`} />
            </ABlock>

            {(analytics?.debt_total ?? 0) > 0 && (
              <ABlock title="Долги (не оплачено)" color={theme.colors.loss}>
                <ARow label="Сумма неоплаченных заявок" value={formatMoney(analytics?.debt_total ?? 0)} neg bold />
              </ABlock>
            )}

            <ABlock title="Окупаемость" color={theme.colors.warning}>
              <ARow label="Стоимость машины" value={formatMoney(settings.machine_cost ?? 89000)} />
              <ARow label="Прошло месяцев" value={String(analytics?.payback_elapsed ?? 0)} />
              <ARow label="Расчётный срок" value={`${analytics?.payback_total ?? 0} мес.`} bold />
            </ABlock>
          </>
        )}

        {tab === 'settings' && (
          <>
            {FIN_FIELDS.map(f => (
              <View key={f.key} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <View style={styles.fieldInput}>
                  <TextInput
                    style={styles.fieldInputText}
                    value={String(settings[f.key] ?? '')}
                    onChangeText={v => setSettings((s: any) => ({
                      ...s,
                      [f.key]: f.key === 'investor_company_name' ? v : (v === '' ? '' : isNaN(Number(v)) ? v : Number(v))
                    }))}
                    keyboardType={f.key === 'investor_company_name' ? 'default' : 'decimal-pad'}
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  {f.suffix ? <Text style={styles.suffix}>{f.suffix}</Text> : null}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Сохранение...' : 'Сохранить настройки'}</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'trucks' && (
          <>
            {trucks.length === 0 && (
              <View style={styles.emptyCard}>
                <Truck size={32} color={theme.colors.textTertiary} />
                <Text style={styles.emptyText}>Нет машин</Text>
                <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={() => router.push('/truck-truck/new')}>
                  <Text style={styles.saveBtnText}>+ Добавить машину</Text>
                </TouchableOpacity>
              </View>
            )}
            {trucks.map(t => (
              <TouchableOpacity key={t.id} style={styles.truckCard} onPress={() => router.push(`/truck-truck/${t.id}`)} onLongPress={() => deleteTruck(t)}>
                <View style={styles.truckIcon}><Truck size={18} color={theme.colors.accent} strokeWidth={1.6} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.truckName}>{t.name || '—'}</Text>
                  <Text style={styles.truckPlate}>{t.plate || '—'}</Text>
                  <Text style={styles.truckDriver}>{t.driver_name || 'Водитель не указан'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ABlock({ title, color, children }: any) {
  return (
    <View style={[aS.block, { borderLeftColor: color }]}>
      <Text style={aS.title}>{title}</Text>
      {children}
    </View>
  );
}
function ARow({ label, value, bold, accent, neg }: any) {
  return (
    <View style={aS.row}>
      <Text style={aS.label}>{label}</Text>
      <Text style={[aS.value, bold && aS.bold, accent && { color: theme.colors.accent }, neg && { color: theme.colors.loss }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  tabRow: { flexDirection: 'row', backgroundColor: theme.colors.surface, marginHorizontal: 20, borderRadius: 10, padding: 3, marginBottom: 4, borderWidth: 1, borderColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: theme.colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: '#000' },
  content: { padding: 20, paddingBottom: 100 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: '#000' },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  fieldInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12 },
  fieldInputText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, paddingVertical: 11 },
  suffix: { fontSize: 12, color: theme.colors.textTertiary, marginLeft: 8 },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  emptyCard: { alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { color: theme.colors.textTertiary, fontSize: 14 },
  truckCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  truckIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  truckName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  truckPlate: { fontSize: 12, color: theme.colors.accent, fontWeight: '600', marginTop: 2 },
  truckDriver: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
});
const aS = StyleSheet.create({
  block: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 3 },
  title: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  label: { fontSize: 13, color: theme.colors.textSecondary },
  value: { fontSize: 13, color: theme.colors.textPrimary },
  bold: { fontWeight: '700' },
});
