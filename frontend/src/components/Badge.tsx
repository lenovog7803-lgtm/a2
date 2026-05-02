import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function Badge({ label, color, testID }: { label: string; color: string; testID?: string }) {
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: color + '1A', borderColor: color + '40' }]}>
      <Text style={[styles.text, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
