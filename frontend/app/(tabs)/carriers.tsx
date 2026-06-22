import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Search, ChevronRight, Star } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

const BG_COLORS = ['#EFF6FF', '#F5F3FF', '#F0FDF4', '#FFFBEB', '#FEF2F2'];
const ACCENT_COLORS = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];
function avatarIdx(name: string): number { return (name?.charCodeAt(0) || 0) % 5; }

export default function Carriers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const c = await api.carriers.list();
      setCarriers(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? carriers.filter(c =>
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.driver_name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.plate || '').toLowerCase().includes(q)
      )
    : carriers;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 8, paddingBottom: 14, backgroundColor: theme.colors.surface, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: -0.8 }}>Перевозчики</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 }}>{carriers.length} контрагентов</Text>
          </View>
          <TouchableOpacity testID="add-carrier-btn" onPress={() => router.push('/carrier/new')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}
          >
            <Plus size={14} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Новый перевозчик</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: theme.colors.border }}>
          <Search size={14} color={theme.colors.textTertiary} strokeWidth={1.5} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Поиск по названию, номеру, телефону..." placeholderTextColor={theme.colors.textTertiary} style={{ flex: 1, fontSize: 13, color: theme.colors.textPrimary }} clearButtonMode="while-editing" />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          testID="carriers-list"
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item, index }) => (
            <CarrierCard carrier={item} onPress={() => router.push(`/carrier/${item.id}`)} testID={`carrier-card-${index}`} />
          )}
          ListEmptyComponent={<Text style={{ color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 }}>Нет перевозчиков</Text>}
        />
      )}
    </View>
  );
}

function CarrierCard({ carrier, onPress, testID }: any) {
  const initials = carrier.company_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const idx = avatarIdx(carrier.company_name || '');
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.78}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: theme.colors.surface, borderRadius: 14, marginBottom: 8, marginHorizontal: 16, borderWidth: 0.5, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: BG_COLORS[idx], alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: ACCENT_COLORS[idx] }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }} numberOfLines={1}>{carrier.company_name}</Text>
        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
          {carrier.driver_name || carrier.phone || 'Нет контакта'}
        </Text>
        {(carrier.vehicle_type || carrier.plate) && (
          <Text style={{ fontSize: 10, color: theme.colors.accent, marginTop: 3, fontWeight: '500' }}>
            {[carrier.vehicle_type, carrier.plate].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      {!!carrier.rating && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 4 }}>
          <Star size={11} color={theme.colors.accent} fill={theme.colors.accent} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.accent }}>{(carrier.rating || 0).toFixed(1)}</Text>
        </View>
      )}
      <ChevronRight size={16} color={theme.colors.textTertiary} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}
