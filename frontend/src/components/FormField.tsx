import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTheme } from '../themeContext';

export function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline, children, testID, style }: any) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginLeft: 2 }}>
        {label}
      </Text>
      {children || (
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          style={[{
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: 12,
            borderWidth: 0.5,
            borderColor: theme.colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: theme.colors.textPrimary,
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? 'top' : undefined,
          }, style]}
        />
      )}
    </View>
  );
}

export function FormSection({ title, children }: any) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.accent, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 0.5, borderColor: theme.colors.border, padding: 14 }}>
        {children}
      </View>
    </View>
  );
}

export function PillPicker({ options, value, onChange }: any) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt: any) => (
        <TouchableOpacity
          key={opt.id}
          onPress={() => onChange(opt.id)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: value === opt.id ? theme.colors.accent + '15' : theme.colors.surfaceElevated,
            borderWidth: 0.5,
            borderColor: value === opt.id ? theme.colors.accent : theme.colors.border,
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, fontWeight: value === opt.id ? '600' : '400', color: value === opt.id ? theme.colors.accent : theme.colors.textSecondary }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
