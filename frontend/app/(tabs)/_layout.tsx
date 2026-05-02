import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { LayoutDashboard, Package, Users, Truck, Phone } from 'lucide-react-native';
import { theme } from '../../src/theme';

export default function TabsLayout() {
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
