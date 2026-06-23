import React, { useState, useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { Tabs, Slot } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Package, Users, Truck, CheckSquare, Phone, DollarSign } from 'lucide-react-native';
import { useTheme } from '../../src/themeContext';
import { AuroraBackground } from '../../src/components/AuroraBackground';
import { Sidebar } from '../../src/components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAB_ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  orders: Package,
  clients: Users,
  carriers: Truck,
  leads: Phone,
  tasks: CheckSquare,
  finance: DollarSign,
};

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Дашборд',
  orders: 'Заявки',
  clients: 'Клиенты',
  carriers: 'Перевозчики',
  leads: 'Обзвон',
  tasks: 'Задачи',
  finance: 'Финансы',
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={80}
      tint={theme.dark ? 'dark' : 'light'}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom,
        borderTopWidth: 0.5,
        borderTopColor: theme.colors.glassBorder,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', paddingTop: 8, paddingHorizontal: 8, paddingBottom: 4 }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = TAB_LABELS[route.name] || options.title || route.name;
          const IconComponent = TAB_ICONS[route.name] || Package;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (options.href === null) return null;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
              activeOpacity={0.7}
            >
              {isFocused ? (
                <View style={{ alignItems: 'center' }}>
                  <IconComponent size={22} color={theme.colors.tabBarActive} strokeWidth={2} />
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.tabBarActive, marginTop: 3 }} />
                </View>
              ) : (
                <IconComponent size={22} color={theme.colors.tabBarInactive} strokeWidth={1.5} />
              )}
              <Text style={{
                fontSize: 10,
                fontWeight: isFocused ? '600' : '400',
                color: isFocused ? theme.colors.tabBarActive : theme.colors.tabBarInactive,
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BlurView>
  );
}

// Web layout with sidebar
function WebLayout({ role }: { role: string }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <AuroraBackground />
      <View style={{
        position: 'relative',
        zIndex: 1,
        flex: 1,
        flexDirection: 'row',
        padding: 16,
        gap: 16,
        paddingTop: insets.top + 16,
      }}>
        <Sidebar />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('user_role').then(r => setRole(r || '')).catch(() => {});
  }, []);

  const isManager = role === 'manager';

  // Web gets sidebar layout
  if (Platform.OS === 'web') {
    return <WebLayout role={role} />;
  }

  // Mobile keeps bottom tab bar
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Дашборд' }} />
      <Tabs.Screen name="finance" options={{ title: 'Финансы', href: isManager ? null : undefined }} />
      <Tabs.Screen name="orders" options={{ title: 'Заявки' }} />
      <Tabs.Screen name="clients" options={{ title: 'Клиенты' }} />
      <Tabs.Screen name="carriers" options={{ title: 'Перевозчики' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Задачи' }} />
      <Tabs.Screen name="leads" options={{ title: 'Обзвон' }} />
    </Tabs>
  );
}
