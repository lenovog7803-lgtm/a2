import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Package, Users, Truck, CheckSquare, Phone, DollarSign } from 'lucide-react-native';
import { useTheme } from '../../src/themeContext';
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
        borderTopColor: theme.colors.border,
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
                <LinearGradient
                  colors={theme.gradients.blue}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 44,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 2,
                  }}
                >
                  <IconComponent size={16} color="#FFFFFF" strokeWidth={2} />
                </LinearGradient>
              ) : (
                <View style={{ width: 44, height: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                  <IconComponent size={18} color={theme.colors.tabBarInactive} strokeWidth={1.5} />
                </View>
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

export default function TabsLayout() {
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('user_role').then(r => setRole(r || '')).catch(() => {});
  }, []);

  const isManager = role === 'manager';

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
