import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme } from '../themeContext';

interface AppCardProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  noPadding?: boolean;
}

export function AppCard({ onPress, children, style, noPadding }: AppCardProps) {
  const { theme } = useTheme();
  const cardStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: noPadding ? 0 : 14,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: theme.dark ? 0.2 : 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[cardStyle, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[cardStyle, style]}>{children}</View>;
}
