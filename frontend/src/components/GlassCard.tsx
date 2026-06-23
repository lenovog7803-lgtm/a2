import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../themeContext';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  strong?: boolean;
  padding?: number;
  borderRadius?: number;
}

export function GlassCard({ children, style, strong, padding = 20, borderRadius = 24 }: GlassCardProps) {
  const { theme } = useTheme();
  return (
    <View style={[{
      borderRadius,
      padding,
      backgroundColor: strong ? theme.colors.glassStrong : theme.colors.glass,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.18,
      shadowRadius: 36,
      elevation: 6,
      overflow: 'hidden',
    }, style]}>
      {/* Top highlight line — glass effect */}
      <View style={styles.highlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1,
  },
});
