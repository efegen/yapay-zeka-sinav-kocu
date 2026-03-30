import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import { girisYap } from '../services/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const handleGiris = async () => {
    if (!email || !sifre) {
      Alert.alert('Hata', 'Email ve şifre alanlarını doldurun.');
      return;
    }
    setYukleniyor(true);
    try {
      await girisYap(email, sifre);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Giriş Başarısız', 'Email veya şifre hatalı.');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            style={styles.logoCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.logoText}>YZ</Text>
          </LinearGradient>
          <Text style={styles.appName}>Sınav Koçu</Text>
          <Text style={styles.appSubtitle}>Hedefe emin adımlarla</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@mail.com"
            placeholderTextColor={COLORS.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textLight}
            value={sifre}
            onChangeText={setSifre}
            secureTextEntry
          />

          <TouchableOpacity onPress={handleGiris} disabled={yukleniyor}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              style={styles.button}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {yukleniyor ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Giriş Yap</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kayitLink}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.kayitLinkText}>
              Hesabın yok mu?{' '}
              <Text style={styles.kayitLinkVurgu}>Kayıt Ol</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { color: COLORS.white, fontSize: 28, fontWeight: '800' },
  appName: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  appSubtitle: { fontSize: 14, color: COLORS.textSecondary },
  form: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 8 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14, padding: 16,
    fontSize: 16, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    marginTop: 4,
  },
  button: {
    borderRadius: 16, padding: 18,
    alignItems: 'center', marginTop: 24,
  },
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  kayitLink: { alignItems: 'center', marginTop: 16 },
  kayitLinkText: { color: COLORS.textSecondary, fontSize: 14 },
  kayitLinkVurgu: { color: COLORS.primary, fontWeight: '700' },
});
