import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

type Props = { label: string; value: string; onChange: (v: string) => void };

export function DateField({ label, value, onChange }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const displayText = value
    ? value.split('-').reverse().join('.')
    : 'Выбрать дату';

  const parsedDate = value ? new Date(value + 'T12:00:00') : new Date();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <input
          type="date"
          value={value || ''}
          onChange={(e: any) => onChange(e.target.value)}
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
      ) : (
        <>
          <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.nativeBtn} activeOpacity={0.7}>
            <Text style={[styles.nativeText, !value && styles.placeholder]}>{displayText}</Text>
          </TouchableOpacity>
          {pickerVisible && (() => {
            const DateTimePickerModal = require('react-native-modal-datetime-picker').default;
            return (
              <DateTimePickerModal
                isVisible={pickerVisible}
                mode="date"
                date={parsedDate}
                onConfirm={(date: Date) => {
                  setPickerVisible(false);
                  onChange(date.toISOString().slice(0, 10));
                }}
                onCancel={() => setPickerVisible(false)}
              />
            );
          })()}
        </>
      )}
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
  nativeBtn: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nativeText: { color: theme.colors.textPrimary, fontSize: 15 },
  placeholder: { color: theme.colors.textTertiary },
});
