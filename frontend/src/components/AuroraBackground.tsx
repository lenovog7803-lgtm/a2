import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform, StyleSheet } from 'react-native';
import { useTheme } from '../themeContext';

export function AuroraBackground() {
  const { theme } = useTheme();
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim1, { toValue: 0, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 1, duration: 26000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 0, duration: 26000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translate1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const translate2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });

  if (theme.dark) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0E1726' }]} />
        <View style={{ position: 'absolute', width: '50%', height: '40%', left: '-5%', top: '-5%', borderRadius: 9999, backgroundColor: 'rgba(19,102,240,0.12)', opacity: 0.8 }} />
        <View style={{ position: 'absolute', width: '45%', height: '40%', right: '-5%', bottom: '10%', borderRadius: 9999, backgroundColor: 'rgba(124,58,237,0.10)', opacity: 0.8 }} />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#EDEFF3' }]} />
      {/* Orange orb */}
      <Animated.View style={{
        position: 'absolute', width: '46%', height: '46%', left: '-8%', top: '-6%',
        borderRadius: 9999, backgroundColor: 'rgba(255,159,90,0.18)',
        transform: [{ translateY: translate1 }],
        ...(Platform.OS === 'web' ? { filter: 'blur(48px)' } : { opacity: 0.7 }),
      }} />
      {/* Blue orb */}
      <Animated.View style={{
        position: 'absolute', width: '50%', height: '50%', right: '-10%', bottom: '-12%',
        borderRadius: 9999, backgroundColor: 'rgba(110,150,255,0.18)',
        transform: [{ translateY: translate2 }],
        ...(Platform.OS === 'web' ? { filter: 'blur(52px)' } : { opacity: 0.7 }),
      }} />
      {/* Green orb */}
      <View style={{
        position: 'absolute', width: '42%', height: '42%', right: '4%', bottom: '4%',
        borderRadius: 9999, backgroundColor: 'rgba(120,224,196,0.14)',
        ...(Platform.OS === 'web' ? { filter: 'blur(44px)' } : { opacity: 0.6 }),
      }} />
      {/* Purple orb */}
      <View style={{
        position: 'absolute', width: '38%', height: '38%', left: '4%', bottom: '8%',
        borderRadius: 9999, backgroundColor: 'rgba(214,160,255,0.13)',
        ...(Platform.OS === 'web' ? { filter: 'blur(40px)' } : { opacity: 0.6 }),
      }} />
    </View>
  );
}
