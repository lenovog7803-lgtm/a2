import React, { useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { CITIES } from '../cities';

interface Props {
  label: string;
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
  testID?: string;
}

export function CityInput({ label, value, onChangeText, placeholder, testID }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);
  const selecting = useRef(false);

  const handleChange = (text: string) => {
    onChangeText(text);
    if (text.length >= 1) {
      const filtered = CITIES.filter(c =>
        c.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 7);
      setSuggestions(filtered);
      setShowList(filtered.length > 0);
    } else {
      setShowList(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!selecting.current) setShowList(false);
      selecting.current = false;
    }, 200);
  };

  const selectCity = (city: string) => {
    selecting.current = true;
    onChangeText(city);
    setShowList(false);
    setSuggestions([]);
  };

  return (
    <View style={[styles.wrap, showList && { zIndex: 999 }]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
      />
      {showList && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="always"
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() => selectCity(item)}
                style={[styles.item, index < suggestions.length - 1 && styles.itemBorder]}
                activeOpacity={0.7}
              >
                <Text style={styles.itemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: theme.colors.textTertiary, marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: theme.colors.textPrimary, fontSize: 15,
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10, zIndex: 1000, elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8,
  },
  item: { paddingHorizontal: 14, paddingVertical: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  itemText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '500' },
});
