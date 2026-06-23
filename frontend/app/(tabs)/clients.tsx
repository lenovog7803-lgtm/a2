import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GRADIENTS: [string, string][] = [
  ['#A5D8FF', '#1366F0'],
  ['#D0BFFF', '#7C3AED'],
  ['#A7F3D0', '#1E9E5A'],
  ['#FCD34D', '#D97706'],
  ['#FCA5A5', '#E0473B'],
  ['#BAE6FD', '#0891B2'],
];
function avatarIdx(name: string) { return (name?.charCodeAt(0) || 0) % GRADIENTS.length; }
function initials(name: string) { return (name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(); }

const CARD_SHADOW = { shadowColor: '#0E1726', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 };

export default function Clients() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.contact_person || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
    : clients;

  return (
    <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : theme.colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14, backgroundColor: theme.colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#0E1726', letterSpacing: -0.8 }}>Клиенты</Text>
            <Text style={{ fontSize: 12.5, color: '#8A93A0', marginTop: 2, fontWeight: '500' }}>
              Всего: <Text style={{ fontFamily: undefined, fontWeight: '700', color: '#0E1726' }}>{clients.length}</Text>
            </Text>
          </View>
          <TouchableOpacity testID="add-client-btn" onPress={() => router.push('/client/new')} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#0E1726', borderRadius: 13, paddingHorizontal: 16, paddingVertical: 11, shadowColor: '#0E1726', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 }}>
            <Plus size={15} color="#fff" strokeWidth={2.2} />
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#fff' }}>Добавить клиента</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(14,23,38,0.08)', ...CARD_SHADOW }}>
          <Search size={15} color="#8A93A0" strokeWidth={1.6} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Поиск по клиентам..." placeholderTextColor="#8A93A0"
            style={{ flex: 1, fontSize: 13.5, color: '#0E1726' }} clearButtonMode="while-editing" />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          testID="clients-list"
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 12 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 100, gap: 12 }}
          renderItem={({ item, index }) => <ClientCard client={item} onPress={() => router.push(`/client/${item.id}`)} testID={`client-card-${index}`} />}
          ListEmptyComponent={<Text style={{ color: '#8A93A0', textAlign: 'center', marginTop: 60, fontSize: 14 }}>Нет клиентов</Text>}
        />
      )}
    </View>
  );
}

function ClientCard({ client, onPress, testID }: any) {
  const idx = avatarIdx(client.name || '');
  const mono = initials(client.name || '');
  const rev = client.total_revenue ? Number(client.total_revenue) : 0;
  const revFmt = rev >= 1000 ? (rev / 1000).toFixed(0) + ' К' : rev > 0 ? String(Math.round(rev)) : '—';
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.88} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(14,23,38,0.07)', ...CARD_SHADOW }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <LinearGradient colors={GRADIENTS[idx]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#0E1726', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{mono}</Text>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#0E1726', letterSpacing: -0.3 }} numberOfLines={1}>{client.name}</Text>
          <Text style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }} numberOfLines={1}>{client.contact_person || client.phone || '—'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, borderRadius: 13, padding: 11, backgroundColor: 'rgba(14,23,38,0.035)' }}>
          <Text style={{ fontSize: 10.5, color: '#8A93A0', marginBottom: 4 }}>Выручка</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0E1726' }}>{revFmt} Br</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 13, padding: 11, backgroundColor: 'rgba(14,23,38,0.035)' }}>
          <Text style={{ fontSize: 10.5, color: '#8A93A0', marginBottom: 4 }}>Заявок</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0E1726' }}>{client.orders_count || 0}</Text>
        </View>
      </View>
      {(client.inn || client.city) && (
        <Text style={{ fontSize: 11.5, color: '#5A6573', marginTop: 12 }} numberOfLines={1}>
          {[client.inn && `УНП ${client.inn}`, client.city].filter(Boolean).join(' · ')}
        </Text>
      )}
    </TouchableOpacity>
  );
}
