import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import {
  Platform, StyleSheet, View, Text, TouchableOpacity, Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Navigation, Users, BarChart2, Menu } from 'lucide-react-native';
import { theme } from '../../src/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TruckLayout() {
  const [modeVisible, setModeVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const switchToExp = async () => {
    await AsyncStorage.setItem('app_mode', 'exp');
    setModeVisible(false);
    router.replace('/(tabs)/dashboard');
  };

  return (
    <View style={{ flex: 1 }}>
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

      <TouchableOpacity
        style={[styles.menuFab, { top: insets.top + 10 }]}
        onPress={() => setModeVisible(true)}
        activeOpacity={0.7}
      >
        <Menu size={16} color={theme.colors.textTertiary} strokeWidth={1.6} />
      </TouchableOpacity>

      <Modal transparent visible={modeVisible} animationType="fade" onRequestClose={() => setModeVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModeVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modeSheet, { top: insets.top + 8, right: 12 }]}>
                <Text style={styles.sheetTitle}>Режим работы</Text>
                <TouchableOpacity style={styles.modeItem} onPress={switchToExp}>
                  <Text style={styles.modeItemIcon}>✅</Text>
                  <Text style={styles.modeItemText}>Экспедирование</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeItem, styles.modeItemActive]} onPress={() => setModeVisible(false)}>
                  <Text style={styles.modeItemIcon}>🚛</Text>
                  <Text style={[styles.modeItemText, styles.modeItemTextActive]}>Моя Машина</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  tabBg: { flex: 1, backgroundColor: 'rgba(10,10,12,0.92)' },
  menuFab: {
    position: 'absolute',
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modeSheet: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: 220,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingHorizontal: 4,
  },
  modeItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  modeItemActive: { backgroundColor: theme.colors.accent + '20' },
  modeItemIcon: { fontSize: 16 },
  modeItemText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  modeItemTextActive: { color: theme.colors.accent },
});
