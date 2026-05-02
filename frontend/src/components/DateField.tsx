import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Calendar, X } from 'lucide-react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { theme } from '../theme';

type Props = {
  label: string;
  value?: string;            // ISO YYYY-MM-DD
  onChange: (iso: string) => void;
  testID?: string;
};

const formatDDMMYYYY = (iso: string) => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
};

const toIso = (d: Date) => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
};

const isWeb = Platform.OS === 'web';

export function DateField({ label, value, onChange, testID }: Props) {
  const [visible, setVisible] = useState(false);

  // На вебе используем нативный <input type="date"> (через скрытый элемент),
  // т.к. react-native-modal-datetime-picker на вебе не идеален.
  if (isWeb) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputBox}>
          <Calendar size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
          {/* @ts-ignore — на вебе React Native позволяет обычные DOM-инпуты через style.appearance */}
          <input
            type="date"
            value={value || ''}
            onChange={(e: any) => onChange(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: theme.colors.textPrimary,
              fontSize: 14,
              fontWeight: 500 as any,
              fontFamily: 'inherit',
              colorScheme: theme.mode === 'dark' ? 'dark' : 'light',
            }}
          />
          {!!value && (
            <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={theme.colors.textTertiary} strokeWidth={1.6} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // iOS / Android — модальный пикер
  const initial = value ? new Date(value) : new Date();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity testID={testID} onPress={() => setVisible(true)} style={styles.inputBox} activeOpacity={0.7}>
        <Calendar size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
        <Text style={[styles.value, !value && { color: theme.colors.textTertiary }]}>
          {value ? formatDDMMYYYY(value) : 'Выбрать дату'}
        </Text>
        {!!value && (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color={theme.colors.textTertiary} strokeWidth={1.6} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={visible}
        mode="date"
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        date={isNaN(initial.getTime()) ? new Date() : initial}
        onConfirm={(d) => { setVisible(false); onChange(toIso(d)); }}
        onCancel={() => setVisible(false)}
        locale="ru_RU"
        confirmTextIOS="Готово"
        cancelTextIOS="Отмена"
        themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: {
    fontSize: 11, fontWeight: '600', color: theme.colors.textTertiary,
    letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase',
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 10, minHeight: 48,
  },
  value: { flex: 1, color: theme.colors.textPrimary, fontSize: 14, fontWeight: '500' },
});
