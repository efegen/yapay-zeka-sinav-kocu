// Press — hover-lift yerine RN'de press-scale dokunma sarmalı (0.97 scale, spring-ish).
import { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

interface PressProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scale?: number;
  disabled?: boolean;
  hitSlop?: number;
}

export function Press({ children, onPress, style, scale = 0.97, disabled, hitSlop }: PressProps) {
  const olcek = useRef(new Animated.Value(1)).current;

  const bas = () =>
    Animated.timing(olcek, { toValue: scale, duration: 90, useNativeDriver: true }).start();
  const birak = () =>
    Animated.timing(olcek, { toValue: 1, duration: 140, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={bas}
      onPressOut={birak}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale: olcek }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
