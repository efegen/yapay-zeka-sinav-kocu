import { useState, useRef } from 'react';
import { Animated } from 'react-native';

export function useSnackbar() {
  const [mesaj, setMesaj] = useState('');
  const anim = useRef(new Animated.Value(0)).current;

  function goster(yeniMesaj: string) {
    setMesaj(yeniMesaj);
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  return { mesaj, anim, goster };
}
