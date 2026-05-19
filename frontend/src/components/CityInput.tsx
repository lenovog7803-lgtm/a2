import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { theme } from '../theme';
import { CITIES } from '../cities';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  testID?: string;
};

export function CityInput({ label, value, onChangeText, testID, ...rest }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [inputHeight, setInputHeight] = useState(72);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = text.trim().toLowerCase();
      if (q.length < 1) { setSuggestions([]); return; }
      const matches = CITIES.filter(c => c.toLowerCase().includes(q)).slice(0, 7);
      setSuggestions(matches);
    }, 200);
  }, [onChangeText]);

  const select = useCallback((city: string) => {
    onChangeText(city);
    setSuggestions([]);
  }, [onChangeText]);

  const dismiss = useCallback(() => { setTimeout(() => setSuggestions([]), 150); }, []);

  return (
    <View
      style={[styles.wrap, suggestions.length > 0 && { zIndex: 100, elevation: 5 }]}
      onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}
    >
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        placeholderTextColor={theme.colors.textTertiary}
        style={styles.input}
        value={value}
        onChangeText={handleChange}
        onBlur={dismiss}
        {...rest}
      />
      {suggestions.length > 0 && (
        <View style={[styles.dropdown, { top: inputHeight - 16 }]}>
          {suggestions.map((city, i) => (
            <TouchableOpacity
              key={city}
              style={[styles.item, i < suggestions.length - 1 && styles.itemBorder]}
              onPress={() => select(city)}
              activeOpacity={0.7}
            >
              <Text style={styles.itemText}>{city}</Text>
            </TouchableOpacity>
          ))}
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
    position: 'absolute', left: 0, right: 0, zIndex: 100, elevation: 5,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8,
  },
  item: {
    paddingHorizontal: 14, paddingVertical: 12,
  },
  itemBorder: {
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  itemText: {
    color: theme.colors.textPrimary, fontSize: 14, fontWeight: '500',
  },
});
