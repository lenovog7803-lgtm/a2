import React from 'react';
import { View } from 'react-native';

// Navigation is handled by _layout.tsx auth check.
// This screen renders briefly while the overlay is visible.
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: '#F5F1EB' }} />;
}
