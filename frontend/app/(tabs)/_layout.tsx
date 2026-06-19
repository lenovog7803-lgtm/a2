import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { LayoutDashboard, Package, Users, Truck, CheckSquare, Phone, DollarSign } from 'lucide-react-native';
import { theme } from '../../src/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabsLayout() {
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('user_role').then(r => setRole(r || '')).catch(() => {});
  }, []);

  const isManager = role === 'manager';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () =>
          Platform.OS === 'web' ? (
            <View style={styles.tabBg} />
          ) : (
            <BlurView
              intensity={80}
              tint={theme.mode === 'dark' ? 'dark' : 'light'}
              style={[StyleSheet.absoluteFill, styles.blurView]}
            />
          ),
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: -2 },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Дашборд',
          tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Финансы',
          href: isManager ? null : undefined,
          tabBarIcon: ({ color }) => <DollarSign size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color }) => <Package size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Клиенты',
          tabBarIcon: ({ color }) => <Users size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="carriers"
        options={{
          title: 'Перевозчики',
          tabBarIcon: ({ color }) => <Truck size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Задачи',
          tabBarIcon: ({ color }) => <CheckSquare size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Обзвон',
          tabBarIcon: ({ color }) => <Phone size={20} color={color} strokeWidth={1.6} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: theme.colors.tabBarBorder,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: Platform.OS === 'web' ? theme.colors.tabBar : 'transparent',
    elevation: 0,
    height: 85,
    paddingBottom: 14,
    paddingTop: 10,
    overflow: 'hidden',
  },
  blurView: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  tabBg: {
    flex: 1,
    backgroundColor: theme.colors.tabBar,
  },
});
