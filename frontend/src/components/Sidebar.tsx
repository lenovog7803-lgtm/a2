import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../themeContext';
import { useRouter, usePathname } from 'expo-router';
import { LayoutDashboard, Package, Users, Truck, CheckSquare, Phone, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react-native';

const NAV_ITEMS = [
  { label: 'Дашборд',      path: '/dashboard',  icon: 'dashboard' },
  { label: 'Заявки',       path: '/orders',     icon: 'orders' },
  { label: 'Финансы',      path: '/finance',    icon: 'finance' },
  { label: 'Задачи',       path: '/tasks',      icon: 'tasks' },
  { label: 'Клиенты',      path: '/clients',    icon: 'clients' },
  { label: 'Перевозчики',  path: '/carriers',   icon: 'carriers' },
  { label: 'База обзвона', path: '/leads',      icon: 'leads' },
];

const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  orders:    Package,
  finance:   DollarSign,
  tasks:     CheckSquare,
  clients:   Users,
  carriers:  Truck,
  leads:     Phone,
};

interface SidebarProps {
  badges?: Record<string, number>;
}

export function Sidebar({ badges }: SidebarProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);

  const sidebarWidth = expanded ? 218 : 66;

  return (
    <View style={{
      width: sidebarWidth,
      backgroundColor: theme.colors.sidebar,
      borderRadius: 22,
      paddingHorizontal: 10,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 8,
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 6, paddingBottom: 20 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#0E1726', alignItems: 'center', justifyContent: 'center', flexShrink: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 }}>
          <Text style={{ fontFamily: 'Onest_800ExtraBold', fontSize: 17, color: '#fff', letterSpacing: -0.5 }}>А2</Text>
        </View>
        {expanded && (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: 'Onest_700Bold', fontSize: 15, color: theme.colors.textPrimary, letterSpacing: -0.3 }}>А2 Group</Text>
            <Text style={{ fontSize: 10, color: theme.colors.textMuted, fontWeight: '700', letterSpacing: 1.2 }}>ГРУЗОПЕРЕВОЗКИ</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => setExpanded(e => !e)}
          style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: theme.colors.borderInner, alignItems: 'center', justifyContent: 'center' }}>
          {expanded
            ? <ChevronLeft size={15} color={theme.colors.textTertiary} strokeWidth={2} />
            : <ChevronRight size={15} color={theme.colors.textTertiary} strokeWidth={2} />}
        </TouchableOpacity>
      </View>

      {expanded && (
        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 1.4, paddingHorizontal: 8, paddingBottom: 8 }}>МЕНЮ</Text>
      )}

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.includes(item.path);
        const badge = badges?.[item.path.replace('/', '')];
        const Icon = ICONS[item.icon];

        return (
          <TouchableOpacity
            key={item.path}
            onPress={() => router.push(item.path as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              paddingHorizontal: 10,
              paddingVertical: 10,
              borderRadius: 13,
              marginBottom: 2,
              backgroundColor: isActive ? theme.colors.accentLight : 'transparent',
            }}
            activeOpacity={0.7}
          >
            {Icon ? <Icon size={19} color={isActive ? theme.colors.accent : theme.colors.textTertiary} strokeWidth={1.8} /> : null}
            {expanded && (
              <>
                <Text style={{ flex: 1, fontSize: 13.5, fontWeight: isActive ? '600' : '500', color: isActive ? theme.colors.accent : theme.colors.textSecondary }}>
                  {item.label}
                </Text>
                {badge && badge > 0 ? (
                  <View style={{ backgroundColor: theme.colors.accent, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{badge}</Text>
                  </View>
                ) : null}
              </>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* User */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.borderInner, marginTop: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ fontFamily: 'Onest_700Bold', fontSize: 13, color: '#fff' }}>ЕА</Text>
        </View>
        {expanded && (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary }}>Егор</Text>
            <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>Директор</Text>
          </View>
        )}
      </View>
    </View>
  );
}
