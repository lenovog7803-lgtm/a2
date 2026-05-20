import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2, RotateCcw, ChevronLeft, AlertTriangle } from 'lucide-react-native';
import { theme, formatMoney } from '../src/theme';
import { api } from '../src/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TYPE_COLOR: Record<string, string> = {
  'Заявка': theme.colors.accent,
  'Клиент': theme.colors.info,
  'Перевозчик': theme.colors.warning,
  'Лид': theme.colors.profit,
};

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
};

export default function TrashScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('user_role').then(r => setUserRole(r || '')).catch(() => {});
    loadTrash();
  }, []));

  const loadTrash = async () => {
    try {
      const data = await api.trash.list();
      setItems(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить корзину');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRestore = async (item: any) => {
    setRestoring(item.id);
    try {
      await api.trash.restore(item.collection, item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось восстановить');
    } finally {
      setRestoring(null);
    }
  };

  const handlePurge = () => {
    if (items.length === 0) {
      Alert.alert('Корзина пуста', 'Нечего удалять.');
      return;
    }
    Alert.alert(
      'Очистить корзину?',
      `Будет безвозвратно удалено ${items.length} ${items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'}. Это действие необратимо.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить', style: 'destructive', onPress: async () => {
            try {
              const r = await api.trash.purge();
              Alert.alert('Готово', `Удалено: ${r.deleted_count}`);
              loadTrash();
            } catch (e: any) {
              Alert.alert('Ошибка', e?.message || 'Не удалось очистить');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={theme.colors.textPrimary} strokeWidth={1.6} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>УДАЛЁННЫЕ ЗАПИСИ</Text>
          <Text style={styles.title}>Корзина</Text>
        </View>
        {userRole === 'admin' && (
          <TouchableOpacity onPress={handlePurge} style={styles.purgeBtn} activeOpacity={0.7}>
            <Trash2 size={16} color={theme.colors.loss} strokeWidth={1.6} />
            <Text style={styles.purgeTxt}>Очистить</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTrash(); }} tintColor={theme.colors.accent} />}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Trash2 size={48} color={theme.colors.textTertiary} strokeWidth={1} />
            <Text style={styles.emptyTxt}>Корзина пуста</Text>
            <Text style={styles.emptySub}>Удалённые заявки, клиенты, перевозчики и лиды появятся здесь</Text>
          </View>
        ) : (
          <>
            <Text style={styles.countTxt}>{items.length} {items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'} · хранится 30 дней</Text>
            {items.map((item) => {
              const color = TYPE_COLOR[item.type] || theme.colors.textSecondary;
              const isRestoring = restoring === item.id;
              return (
                <View key={`${item.collection}-${item.id}`} style={styles.card}>
                  <View style={[styles.typeBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                    <Text style={[styles.typeText, { color }]}>{item.type}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.date}>Удалено: {formatDate(item.deleted_at)}</Text>
                    {item.days_left != null && (
                      <Text style={[styles.daysLeft, item.days_left <= 3 && styles.daysLeftUrgent]}>
                        Удалится через {item.days_left} {item.days_left === 1 ? 'день' : item.days_left < 5 ? 'дня' : 'дней'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRestore(item)}
                    disabled={isRestoring}
                    style={[styles.restoreBtn, isRestoring && { opacity: 0.5 }]}
                    activeOpacity={0.7}
                  >
                    {isRestoring ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                      <>
                        <RotateCcw size={14} color={theme.colors.accent} strokeWidth={1.8} />
                        <Text style={styles.restoreTxt}>Вернуть</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary },
  title: { fontSize: 24, fontWeight: '300', letterSpacing: -0.5, color: theme.colors.textPrimary },
  purgeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.loss + '12', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.loss + '30' },
  purgeTxt: { color: theme.colors.loss, fontSize: 12, fontWeight: '700' },

  countTxt: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: '600', marginBottom: 12 },

  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  typeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  cardBody: { flex: 1 },
  label: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  date: { color: theme.colors.textTertiary, fontSize: 11 },

  restoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.colors.accent + '15', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.accent + '30' },
  restoreTxt: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  daysLeft: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 2 },
  daysLeftUrgent: { color: theme.colors.loss },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTxt: { color: theme.colors.textSecondary, fontSize: 18, fontWeight: '600' },
  emptySub: { color: theme.colors.textTertiary, fontSize: 13, textAlign: 'center', maxWidth: 260 },
});
