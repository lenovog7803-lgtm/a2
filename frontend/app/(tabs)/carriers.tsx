import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Phone, Star, Truck as TruckIcon, Search } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

export default function Carriers() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const c = await api.carriers.list();
      setCarriers(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? carriers.filter(c =>
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.driver_name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.plate || '').toLowerCase().includes(q)
      )
    : carriers;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, paddingTop: insets.top + 16 }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>ПАРК</Text>
          <Text style={styles.title}>Перевозчики</Text>
        </View>
        <TouchableOpacity testID="add-carrier-btn" onPress={() => router.push('/carrier/new')} style={styles.fab} activeOpacity={0.8}>
          <Plus size={20} color="#000" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по компании, водителю, телефону, гос номеру"
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
          testID="carriers-list"
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index }) => <CarrierCard carrier={item} onPress={() => router.push(`/carrier/${item.id}`)} testID={`carrier-card-${index}`} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет перевозчиков</Text>}
        />
      )}
    </View>
  );
}

function CarrierCard({ carrier, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <TruckIcon size={20} color={theme.colors.accent} strokeWidth={1.6} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{carrier.company_name}</Text>
          {!!carrier.driver_name && <Text style={styles.contact}>{carrier.driver_name}</Text>}
        </View>
        <View style={styles.ratingBox}>
          <Star size={12} color={theme.colors.accent} fill={theme.colors.accent} />
          <Text style={styles.rating}>{(carrier.rating || 0).toFixed(1)}</Text>
        </View>
      </View>

      {!!(carrier.vehicle_type || carrier.plate) && (
        <View style={styles.tagsRow}>
          {!!carrier.vehicle_type && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{carrier.vehicle_type}</Text>
            </View>
          )}
          {!!carrier.capacity_tons && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{carrier.capacity_tons} т</Text>
            </View>
          )}
          {!!carrier.capacity_m3 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{carrier.capacity_m3} м³</Text>
            </View>
          )}
          {!!carrier.plate && (
            <View style={[styles.tag, styles.plateTag]}>
              <Text style={[styles.tagText, { color: theme.colors.accent }]}>{carrier.plate}</Text>
            </View>
          )}
        </View>
      )}

      {!!carrier.phone && (
        <TouchableOpacity
          style={styles.callBtn}
          onPress={(e: any) => { e.stopPropagation?.(); Linking.openURL(`tel:${carrier.phone}`); }}
          activeOpacity={0.7}
        >
          <Phone size={14} color={theme.colors.accent} strokeWidth={1.6} />
          <Text style={styles.callText}>{carrier.phone}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.textTertiary, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '300', letterSpacing: -1, color: theme.colors.textPrimary },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: theme.colors.accent + '15',
    borderWidth: 1, borderColor: theme.colors.accent + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  contact: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: theme.colors.surfaceElevated, borderRadius: 6,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  plateTag: { borderColor: theme.colors.accent + '40', backgroundColor: theme.colors.accent + '10' },
  tagText: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },

  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.colors.surfaceElevated, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, alignSelf: 'flex-start',
  },
  callText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '500' },

  empty: { color: theme.colors.textTertiary, textAlign: 'center', marginTop: 60, fontSize: 14 },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 12 },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
});
