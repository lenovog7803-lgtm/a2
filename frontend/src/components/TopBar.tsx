import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Search, Bell, Calendar, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../themeContext';
import { GlassCard } from './GlassCard';

interface TopBarProps {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  onPeriodPress?: () => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  rightAction?: React.ReactNode;
}

export function TopBar({ title, subtitle, periodLabel, onPeriodPress, searchValue, onSearchChange, rightAction }: TopBarProps) {
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  return (
    <GlassCard padding={14} borderRadius={22} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 } as any}>
      <View style={{ minWidth: 0 }}>
        <Text style={{ fontFamily: 'Onest_700Bold', fontSize: 22, color: theme.colors.textPrimary, letterSpacing: -0.5 }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 12.5, color: theme.colors.textTertiary, fontWeight: '500', marginTop: 1 }}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />

      {/* Search — only on web where there's space */}
      {isWeb && onSearchChange ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: theme.colors.borderInner, width: 280 }}>
          <Search size={17} color={theme.colors.textTertiary} strokeWidth={1.9} />
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder="Поиск…"
            placeholderTextColor={theme.colors.textTertiary}
            style={{ flex: 1, fontSize: 13.5, color: theme.colors.textPrimary }}
          />
        </View>
      ) : null}

      {/* Period picker */}
      {periodLabel ? (
        <TouchableOpacity onPress={onPeriodPress}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: theme.colors.borderInner }}>
          <Calendar size={15} color={theme.colors.textSecondary} strokeWidth={1.8} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary }}>{periodLabel}</Text>
          <ChevronDown size={13} color={theme.colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      ) : null}

      {rightAction}

      {/* Notifications */}
      <TouchableOpacity style={{ width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.borderInner, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
        <Bell size={17} color={theme.colors.textSecondary} strokeWidth={1.8} />
        <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#E0473B', borderWidth: 1.5, borderColor: '#fff' }} />
      </TouchableOpacity>
    </GlassCard>
  );
}
