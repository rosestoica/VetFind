import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');

interface LoginScreenProps {
  navigation?: any;
}

function getLoginErrorRomanian(rawMessage: string): string {
  const msg = (rawMessage || '').trim().toLowerCase();
  if (msg.includes('no account') || msg.includes('not found') || msg.includes('this email')) {
    return 'Nu există cont asociat acestei adrese de email. Verifică adresa sau creează un cont.';
  }
  if (msg.includes('invalid password') || msg.includes('parola')) {
    return 'Parola introdusă este incorectă. Încearcă din nou.';
  }
  return 'Email sau parolă invalidă. Verifică datele introduse.';
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { login, loginError, clearLoginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const displayError = errorMessage || (loginError ? getLoginErrorRomanian(loginError) : '');

  const handleLogin = async () => {
    setErrorMessage('');
    clearLoginError();
    // Validate input
    if (!email.trim()) {
      setErrorMessage('Introdu adresa de email.');
      return;
    }

    if (!password) {
      setErrorMessage('Introdu parola.');
      return;
    }

    try {
      setLoading(true);

      await login({
        email: email.toLowerCase(),
        password,
      });

      // No need to navigate - AuthContext will handle it automatically
    } catch (_error: any) {
      // Eroarea e deja setată în context (loginError) și supraviețuiește la re-mount
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#fafaf9', '#f5f5f4', '#fafaf9']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentWrapper}>
              {/* Background: labe de lăbuțe și motive animale */}
              <View style={styles.floatingPawsContainer}>
                <Ionicons name="paw" size={42} color="rgba(37, 99, 235, 0.12)" style={styles.floatingPaw1} />
                <Ionicons name="paw" size={38} color="rgba(234, 88, 12, 0.14)" style={styles.floatingPaw2} />
                <Ionicons name="paw" size={48} color="rgba(37, 99, 235, 0.1)" style={styles.floatingPaw3} />
                <Ionicons name="paw" size={36} color="rgba(234, 88, 12, 0.11)" style={styles.floatingPaw4} />
                <Ionicons name="paw" size={44} color="rgba(37, 99, 235, 0.11)" style={styles.floatingPaw5} />
                <Ionicons name="paw" size={34} color="rgba(234, 88, 12, 0.12)" style={styles.floatingPaw6} />
                <Ionicons name="paw" size={28} color="rgba(37, 99, 235, 0.08)" style={styles.floatingPaw7} />
                <Ionicons name="paw" size={32} color="rgba(234, 88, 12, 0.09)" style={styles.floatingPaw8} />
                <Ionicons name="paw" size={26} color="rgba(37, 99, 235, 0.07)" style={styles.floatingPaw9} />
              </View>

              <View style={styles.cardContainer}>
                <View style={styles.content}>
              {/* Logo cu lăbuță */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#2563eb', '#60a5fa']}
                  style={styles.logoGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="paw" size={52} color="#ffffff" />
                </LinearGradient>
                <Ionicons name="paw" size={20} color="rgba(37, 99, 235, 0.35)" style={styles.decorativePaw1} />
                <Ionicons name="paw" size={18} color="rgba(234, 88, 12, 0.35)" style={styles.decorativePaw2} />
              </View>

              {/* Titlu mare */}
              <Text style={styles.title}>VetFinder</Text>
              <Text style={styles.subtitle}>🐾 Bine ai revenit! </Text>
              <Text style={styles.subtitle}>Găsește veterinarul potrivit pentru animalul tău. 🐾</Text>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#2563eb" style={styles.inputIcon} />
                  <Text style={styles.inputLabel}>Adresă email</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="email@domeniu.com"
                  placeholderTextColor="#a0a0a0"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setErrorMessage(''); clearLoginError(); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>

              {displayError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#dc2626" style={styles.errorIcon} />
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              ) : null}

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#2563eb" style={styles.inputIcon} />
                  <Text style={styles.inputLabel}>Parolă</Text>
                </View>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••••••"
                    placeholderTextColor="#a0a0a0"
                    value={password}
                    onChangeText={(t) => { setPassword(t); setErrorMessage(''); clearLoginError(); }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={22}
                      color="#a0a0a0"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                activeOpacity={0.9}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#ea580c', '#fb923c']}
                  style={styles.loginButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Autentificare</Text>
                      <Ionicons name="arrow-forward" size={20} color="#ffffff" style={styles.arrowIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>Nu ai cont? </Text>
                <TouchableOpacity onPress={() => navigation?.navigate('SignUp')}>
                  <Text style={styles.signUpLink}>Creează cont</Text>
                </TouchableOpacity>
              </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  floatingPawsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingPaw1: {
    position: 'absolute',
    top: '10%',
    left: '8%',
    transform: [{ rotate: '-15deg' }],
  },
  floatingPaw2: {
    position: 'absolute',
    top: '15%',
    right: '12%',
    transform: [{ rotate: '25deg' }],
  },
  floatingPaw3: {
    position: 'absolute',
    top: '45%',
    left: '5%',
    transform: [{ rotate: '10deg' }],
  },
  floatingPaw4: {
    position: 'absolute',
    bottom: '20%',
    left: '10%',
    transform: [{ rotate: '-20deg' }],
  },
  floatingPaw5: {
    position: 'absolute',
    top: '50%',
    right: '8%',
    transform: [{ rotate: '15deg' }],
  },
  floatingPaw6: {
    position: 'absolute',
    bottom: '15%',
    right: '15%',
    transform: [{ rotate: '-10deg' }],
  },
  floatingPaw7: {
    position: 'absolute',
    top: '28%',
    right: '20%',
    transform: [{ rotate: '12deg' }],
  },
  floatingPaw8: {
    position: 'absolute',
    bottom: '35%',
    left: '18%',
    transform: [{ rotate: '-8deg' }],
  },
  floatingPaw9: {
    position: 'absolute',
    top: '70%',
    left: '22%',
    transform: [{ rotate: '18deg' }],
  },
  cardContainer: {
    backgroundColor: '#fafaf9',
    borderRadius: 24,
    boxShadow: '0 10px 20px rgba(37, 99, 235, 0.08)',
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.15)',
    maxWidth: 420,
    width: '100%',
    marginHorizontal: 20,
    zIndex: 10,
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 44,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  decorativePaw1: {
    position: 'absolute',
    top: -6,
    right: 100,
    transform: [{ rotate: '-25deg' }],
  },
  decorativePaw2: {
    position: 'absolute',
    top: -4,
    left: 100,
    transform: [{ rotate: '20deg' }],
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
    elevation: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#2563eb',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 28,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputLabel: {
    fontSize: 17,
    color: '#444444',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -11 }],
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 15,
    color: '#dc2626',
    fontWeight: '500',
  },
  loginButton: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(234, 88, 12, 0.3)',
    elevation: 6,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  loginButtonText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  arrowIcon: {
    marginLeft: 10,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  signUpText: {
    fontSize: 17,
    color: '#555555',
  },
  signUpLink: {
    fontSize: 17,
    color: '#2563eb',
    fontWeight: 'bold',
  },
});

export default LoginScreen;
