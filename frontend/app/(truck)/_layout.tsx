import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LayoutDashboard, Navigation, Users, BarChart2 } from 'lucide-react-native';
import { theme } from '../../src/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TruckLayout() {
  const router = useRouter();

  const switchToExp = async () => {
    await AsyncStorage.setItem('app_mode', 'exp');
    router.replace('/(tabs)/dashboard');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.modeBar}>
        <View style={styles.modeToggle}>
          <TouchableOpacity style={styles.modeBtn} onPress={switchToExp}>
            <Text style={styles.modeBtnText}>Экспедирование</Text>
          </TouchableOpacity>
          <View style={[styles.modeBtn, styles.modeBtnActive]}>
            <Text style={[styles.modeBtnText, styles.modeBtnTextActive]}>Моя Машина</Text>
          </View>
        </View>
      </View>
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
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            ),
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: -2 },
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
          name="trips"
          options={{
            title: 'Рейсы',
            tabBarIcon: ({ color }) => <Navigation size={20} color={color} strokeWidth={1.6} />,
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
          name="finances"
          options={{
            title: 'Финансы',
            tabBarIcon: ({ color }) => <BarChart2 size={20} color={color} strokeWidth={1.6} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  modeBar: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingTop: Platform.OS === 'ios' ? 52 : 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
    padding: 3,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: theme.colors.accent,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  modeBtnTextActive: {
    color: '#000',
  },
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: Platform.OS === 'web' ? 'rgba(10,10,12,0.92)' : 'transparent',
    elevation: 0,
    height: 72,
    paddingBottom: 12,
    paddingTop: 10,
  },
  tabBg: {
    flex: 1,
    backgroundColor: 'rgba(10,10,12,0.92)',
  },
});
