import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { theme } from '../theme';

type Props = { label: string; value: string; onChange: (v: string) => void };

export function DateField({ label, value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{
            backgroundColor: theme.colors.surfaceElevated,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            color: theme.colors.textPrimary,
            fontSize: 15,
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.textTertiary,
    marginBottom: 6,
  },
});
