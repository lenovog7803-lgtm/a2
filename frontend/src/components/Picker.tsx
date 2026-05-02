import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, TextInput } from 'react-native';
import { ChevronDown, Search, Check, X } from 'lucide-react-native';
import { theme } from '../theme';

type Item = { id: string; label: string; sublabel?: string };

type Props = {
  label: string;
  value: string;
  items: Item[];
  onSelect: (item: Item) => void;
  placeholder?: string;
  searchable?: boolean;
  testID?: string;
};

export function Picker({ label, value, items, onSelect, placeholder = 'Выбрать…', searchable = true, testID }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = items.find(i => i.id === value);
  const filtered = query
    ? items.filter(i => (i.label + ' ' + (i.sublabel || '')).toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TouchableOpacity testID={testID} onPress={() => setOpen(true)} activeOpacity={0.7} style={styles.input}>
        <Text style={[styles.value, !selected && { color: theme.colors.textTertiary }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <X size={20} color={theme.colors.textPrimary} strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
            {searchable && (
              <View style={styles.searchBox}>
                <Search size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
                <TextInput
                  placeholder="Поиск…"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  style={styles.search}
                  autoFocus
                />
              </View>
            )}
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.id === value;
                return (
                  <TouchableOpacity
                    style={[styles.item, active && styles.itemActive]}
                    onPress={() => { onSelect(item); setOpen(false); setQuery(''); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemLabel, active && { color: theme.colors.accent }]} numberOfLines={1}>{item.label}</Text>
                      {!!item.sublabel && <Text style={styles.itemSub} numberOfLines={1}>{item.sublabel}</Text>}
                    </View>
                    {active && <Check size={16} color={theme.colors.accent} strokeWidth={2} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>Ничего не найдено</Text>}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: theme.colors.textTertiary, marginBottom: 6 },
  input: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  value: { color: theme.colors.textPrimary, fontSize: 15, flex: 1, marginRight: 8 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  search: { flex: 1, color: theme.colors.textPrimary, fontSize: 15, padding: 0 },

  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  itemActive: { backgroundColor: theme.colors.accent + '10' },
  itemLabel: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '500' },
  itemSub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { color: theme.colors.textTertiary, textAlign: 'center', padding: 30, fontSize: 14 },
});
