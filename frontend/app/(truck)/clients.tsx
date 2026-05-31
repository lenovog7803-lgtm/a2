import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Linking, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Phone, Mail, Search } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

export default function TruckClients() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try { setClients(await api.truck.clients.list() as any[]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q)
      )
    : clients;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>БАЗА</Text>
          <Text style={styles.title}>Клиенты</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/truck-client/new')}>
          <Plus size={20} color="#000" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по названию, телефону, городу"
          placeholderTextColor={theme.colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/truck-client/${item.id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  {!!item.city && <Text style={styles.sub}>{item.city}</Text>}
                </View>
              </View>
              {(!!item.unp || !!item.industry) && (
                <View style={styles.meta}>
                  {!!item.unp && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>УНП</Text>
                      <Text style={styles.metaValue}>{item.unp}</Text>
                    </View>
                  )}
                  {!!item.industry && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>ОТРАСЛЬ</Text>
                      <Text style={styles.metaValue}>{item.industry}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.actions}>
                {!!item.phone && (
                  <TouchableOpacity style={styles.actionBtn} onPress={(e: any) => { e.stopPropagation?.(); Linking.openURL(`tel:${item.phone}`); }}>
                    <Phone size={14} color={theme.colors.accent} strokeWidth={1.6} />
                    <Text style={styles.actionText}>{item.phone}</Text>
                  </TouchableOpacity>
                )}
                {!!item.email && (
                  <TouchableOpacity style={styles.actionBtn} onPress={(e: any) => { e.stopPropagation?.(); Linking.openURL(`mailto:${item.email}`); }}>
                    <Mail size={14} color={theme.colors.accent} strokeWidth={1.6} />
                    <Text style={styles.actionText} numberOfLines={1}>{item.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Нет клиентов</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 12 },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent + '20', borderWidth: 1, borderColor: theme.colors.accent + '40', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.colors.accent, fontSize: 14, fontWeight: '700' },
  name: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  sub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  meta: { flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.textTertiary, marginBottom: 2 },
  metaValue: { fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.colors.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  actionText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' },
  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },
});
