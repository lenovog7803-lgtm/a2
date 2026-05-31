import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

export default function TruckClients() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.truck.clients.list() as any[];
      setClients(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/truck-client/${item.id}`)}>
      <Text style={styles.name}>{item.name}</Text>
      {item.contact_person ? <Text style={styles.sub}>{item.contact_person}</Text> : null}
      {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
      <View style={styles.tagsRow}>
        {item.city_loading ? <Tag text={`Загрузка: ${item.city_loading}`} /> : null}
        {item.city_unloading ? <Tag text={`Выгрузка: ${item.city_unloading}`} /> : null}
        {item.typical_pallets ? <Tag text={`${item.typical_pallets} пал.`} /> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Клиенты</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/truck-client/new')}>
          <Plus size={20} color="#000" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
          ListEmptyComponent={<Text style={styles.empty}>Нет клиентов</Text>}
        />
      )}
    </View>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary },
  addBtn: {
    backgroundColor: theme.colors.accent, borderRadius: 10,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    backgroundColor: theme.colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border,
  },
  tagText: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '600' },
  empty: { textAlign: 'center', color: theme.colors.textTertiary, fontSize: 14, paddingTop: 40 },
});
