import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LayoutDashboard, Package, Users, Truck, Phone, CheckSquare, DollarSign,
  ChevronLeft, ChevronRight, LogOut
} from 'lucide-react-native';

if (Platform.OS === 'web') {
  // @ts-ignore
  require('../../src/globals.css');
}

const NAV = [
  { key: 'dashboard', label: 'Дашборд', path: '/(tabs)/dashboard' as const, Icon: LayoutDashboard },
  { key: 'orders', label: 'Заявки', path: '/(tabs)/orders' as const, Icon: Package },
  { key: 'clients', label: 'Клиенты', path: '/(tabs)/clients' as const, Icon: Users },
  { key: 'carriers', label: 'Перевозчики', path: '/(tabs)/carriers' as const, Icon: Truck },
  { key: 'leads', label: 'Обзвон', path: '/(tabs)/leads' as const, Icon: Phone },
  { key: 'tasks', label: 'Задачи', path: '/(tabs)/tasks' as const, Icon: CheckSquare },
  { key: 'finance', label: 'Финансы', path: '/(tabs)/finance' as const, Icon: DollarSign },
];

const GLASS_BG = 'rgba(255,255,255,0.72)';
const GLASS_BORDER = 'rgba(255,255,255,0.72)';
const DARK = '#0E1726';

export default function TabsLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState('');
  const [userInitial, setUserInitial] = useState('A');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    AsyncStorage.getItem('user_data').then(d => {
      if (d) {
        try {
          const u = JSON.parse(d);
          const name = u.name || u.login || '';
          setUserName(name);
          setUserInitial((name.charAt(0) || 'A').toUpperCase());
        } catch {}
      }
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['jwt_token', 'user_role', 'user_data']).catch(() => {});
    router.replace('/login' as any);
  };

  const sidebarW = collapsed ? 66 : 218;

  return (
    <View style={styles.root}>
      {/* Aurora background applied via globals.css on web */}

      {/* Sidebar */}
      <View style={[styles.sidebar, { width: sidebarW }]}>
        {/* Brand */}
        <View style={[styles.brand, collapsed && styles.brandCollapsed]}>
          <View style={styles.brandLogo}>
            <Text style={styles.brandLogoText}>A</Text>
          </View>
          {!collapsed && (
            <View>
              <Text style={styles.brandName}>А2 Group</Text>
              <Text style={styles.brandSub}>CRM система</Text>
            </View>
          )}
        </View>

        {!collapsed && <Text style={styles.menuLabel}>МЕНЮ</Text>}

        {/* Nav items */}
        <View style={styles.navList}>
          {NAV.map(({ key, label, path, Icon }) => {
            const isActive = pathname === `/${key}` || pathname.includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.navItem, isActive && styles.navItemActive, collapsed && styles.navItemCollapsed]}
                onPress={() => router.push(path as any)}
                activeOpacity={0.7}
              >
                <Icon size={20} color={isActive ? DARK : '#5A6573'} strokeWidth={isActive ? 2.2 : 1.8} />
                {!collapsed && (
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
                    {label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {!collapsed && (
            <View style={styles.userRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{userInitial}</Text>
              </View>
              {userName ? (
                <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
              ) : null}
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <LogOut size={14} color="#8A93A0" />
              </TouchableOpacity>
            </View>
          )}
          {collapsed && (
            <TouchableOpacity onPress={handleLogout} style={[styles.collapseBtn, { marginBottom: 8 }]}>
              <LogOut size={14} color="#8A93A0" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.collapseBtn} onPress={() => setCollapsed(c => !c)}>
            {collapsed
              ? <ChevronRight size={15} color="#8A93A0" />
              : <ChevronLeft size={15} color="#8A93A0" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content area */}
      <View style={styles.main}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EDEFF3',
  },
  sidebar: {
    backgroundColor: GLASS_BG,
    borderRightWidth: 1,
    borderRightColor: GLASS_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 18,
    flexDirection: 'column',
    shadowColor: DARK,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 100,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  brandCollapsed: { justifyContent: 'center' },
  brandLogo: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: DARK, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  brandLogoText: { color: '#fff', fontFamily: 'Onest_700Bold', fontSize: 16 },
  brandName: { fontFamily: 'Onest_700Bold', fontSize: 15, color: DARK },
  brandSub: { fontSize: 11, color: '#8A93A0', marginTop: 1 },
  menuLabel: {
    fontSize: 10.5, fontFamily: 'Manrope_600SemiBold',
    letterSpacing: 1, color: '#A6AEB8', marginBottom: 8, marginLeft: 4,
  },
  navList: { flex: 1, gap: 3 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  navLabel: { fontFamily: 'Manrope_500Medium', fontSize: 14.5, color: '#5A6573', flex: 1 },
  navLabelActive: { fontFamily: 'Manrope_600SemiBold', color: DARK },
  footer: { paddingTop: 12, gap: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  userAvatar: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: DARK, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  userAvatarText: { color: '#fff', fontFamily: 'Onest_700Bold', fontSize: 11 },
  userName: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: DARK, flex: 1 },
  logoutBtn: {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    backgroundColor: 'rgba(14,23,38,0.04)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(14,23,38,0.07)',
  },
  collapseBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(14,23,38,0.04)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(14,23,38,0.07)',
  },
  main: { flex: 1, overflow: 'hidden' as any },
});
