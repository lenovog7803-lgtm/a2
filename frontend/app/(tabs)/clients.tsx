import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking, TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Phone, Mail, Search } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MiniChart } from '../../src/components/MiniChart';

export default function Clients() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await AsyncStorage.getItem('user_role').catch(() => null);
      const isManager = r === 'manager';
      let myClientNames: Set<string> | null = null;
      if (isManager) {
        const orders = await api.orders.list().catch(() => []);
        myClientNames = new Set(orders.map((o: any) => o.client_name).filter(Boolean));
      }
      const c = await api.clients.list();
      setClients(isManager && myClientNames ? c.filter((cl: any) => myClientNames!.has(cl.name)) : c);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.contact_person || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
    : clients;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.title}>Клиенты</Text>
        <TouchableOpacity testID="add-client-btn" onPress={() => router.push('/client/new')} style={styles.fab} activeOpacity={0.8}>
          <Plus size={20} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={14} color={theme.colors.textTertiary} strokeWidth={1.5} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск..."
          placeholderTextColor={theme.colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          testID="clients-list"
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item, index }) => <ClientCard client={item} onPress={() => router.push(`/client/${item.id}`)} testID={`client-card-${index}`} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет клиентов</Text>}
        />
      )}
    </View>
  );
}

function ClientCard({ client, onPress, testID }: any) {
  const { width: screenW } = useWindowDimensions();
  const initials = client.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const chartWidth = screenW - 40 - 28;

  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{client.name}</Text>
          {!!client.contact_person && <Text style={styles.contact}>{client.contact_person}</Text>}
        </View>
      </View>

      {(!!client.inn || !!client.payment_terms) && (
        <View style={styles.meta}>
          {!!client.inn && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>ИНН</Text>
              <Text style={styles.metaValue}>{client.inn}</Text>
            </View>
          )}
          {!!client.payment_terms && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>ОТСРОЧКА</Text>
              <Text style={styles.metaValue}>{client.payment_terms}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        {!!client.phone && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e: any) => { e.stopPropagation?.(); Linking.openURL(`tel:${client.phone}`); }}
            activeOpacity={0.7}
          >
            <Phone size={14} color={theme.colors.accent} strokeWidth={1.6} />
            <Text style={styles.actionText}>{client.phone}</Text>
          </TouchableOpacity>
        )}
        {!!client.email && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e: any) => { e.stopPropagation?.(); Linking.openURL(`mailto:${client.email}`); }}
            activeOpacity={0.7}
          >
            <Mail size={14} color={theme.colors.accent} strokeWidth={1.6} />
            <Text style={styles.actionText} numberOfLines={1}>{client.email}</Text>
          </TouchableOpacity>
        )}
      </View>
      {client.monthlyRevenue && client.monthlyRevenue.length > 1 && (
        <View style={{ marginTop: 10 }}>
          <MiniChart data={client.monthlyRevenue} width={chartWidth} height={40} color="#2563EB" showTooltip={false} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: theme.colors.textPrimary },
  fab: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 0.5, borderColor: theme.colors.border, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.accent + '20',
    borderWidth: 1, borderColor: theme.colors.accent + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: theme.colors.accent, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  name: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  contact: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },

  meta: { flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.textTertiary, marginBottom: 2 },
  metaValue: { fontSize: 13, color: theme.colors.textPrimary, fontWeight: '500' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: theme.colors.surfaceElevated, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  actionText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' },
  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderWidth: 0.5, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 16, marginBottom: 10 },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
});
