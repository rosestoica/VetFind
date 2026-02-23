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
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { blurActiveElementIfWeb } from '../utils/dom';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CountyPicker } from '../components/FormComponents/CountyPicker';
import { LocalityPicker } from '../components/FormComponents/LocalityPicker';
import { CountyCode } from '../constants/romania';
import { buildAddressForGeocoding, geocodeAddress } from '../utils/geocoding';
import { validateRomanianPostalCode } from '../utils/romanianValidation';

const { width, height } = Dimensions.get('window');

type UserRole = 'user' | 'vetcompany';

interface SignUpScreenProps {
  navigation?: any;
}

// Address state interface
interface HomeAddress {
  street: string;
  streetNumber: string;
  building: string;
  apartment: string;
  city: string;
  county: CountyCode | '';
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);

  // Home address state (for pet owners)
  const [homeAddress, setHomeAddress] = useState<HomeAddress>({
    street: '',
    streetNumber: '',
    building: '',
    apartment: '',
    city: '',
    county: '',
    postalCode: '',
    country: 'Romania',
    latitude: null,
    longitude: null,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [showEmergencyClinics, setShowEmergencyClinics] = useState(false);

  // Inline validation state (keeps user on the same progress with data preserved)
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const MIN_PASSWORD_LENGTH = 8;
  const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

  const checkPasswordStrength = (pass: string) => {
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[a-z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    checkPasswordStrength(text);
  };

  const isValidEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const getPasswordIssues = (pass: string): string[] => {
    const issues: string[] = [];
    if ((pass || '').length < MIN_PASSWORD_LENGTH) issues.push(`cel puțin ${MIN_PASSWORD_LENGTH} caractere`);
    if (!/[A-Z]/.test(pass)) issues.push('o literă mare');
    if (!/[a-z]/.test(pass)) issues.push('o literă mică');
    if (!/[0-9]/.test(pass)) issues.push('o cifră');
    if (!SPECIAL_CHAR_REGEX.test(pass)) issues.push('un caracter special');
    return issues;
  };

  const shouldShowError = (field: keyof typeof touched) => submitAttempted || touched[field];

  const errors = {
    fullName: !fullName.trim() ? 'Introdu numele complet' : '',
    email: !email.trim() ? 'Introdu emailul' : (!isValidEmail(email) ? 'Introdu o adresă de email validă' : ''),
    password: '',
    confirmPassword: '',
  };

  const passwordIssues = getPasswordIssues(password);
  if (!password) {
    errors.password = 'Introdu o parolă';
  } else if (passwordIssues.length > 0) {
    // Make it explicit: too short / missing special chars etc.
    errors.password = `Parola trebuie să conțină: ${passwordIssues.join(', ')}`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirmă parola';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Parolele nu coincid';
  }

  const isFormValid = !errors.fullName && !errors.email && !errors.password && !errors.confirmPassword;

  // Update address field
  const updateAddress = (field: keyof HomeAddress, value: any) => {
    setHomeAddress((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (addressErrors[field]) {
      setAddressErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Handle county change (reset city when county changes)
  const handleCountyChange = (county: CountyCode) => {
    setHomeAddress((prev) => ({
      ...prev,
      county,
      city: prev.county !== county ? '' : prev.city,
    }));
  };

  // Geocoding ONLY on button press; address is validated here before computing coords.
  const geocodeHomeAddress = async () => {
    const errs: Record<string, string> = {};
    if (!homeAddress.street?.trim()) errs.street = 'Strada este obligatorie';
    if (!homeAddress.streetNumber?.trim()) errs.streetNumber = 'Numărul este obligatoriu';
    if (!homeAddress.city?.trim()) errs.city = 'Localitatea este obligatorie';
    if (!homeAddress.county?.trim()) errs.county = 'Județul este obligatoriu';
    if (!homeAddress.postalCode?.trim()) {
      errs.postalCode = 'Codul poștal este obligatoriu';
    } else if (!validateRomanianPostalCode(homeAddress.postalCode)) {
      errs.postalCode = 'Format invalid (6 cifre)';
    }

    if (Object.keys(errs).length > 0) {
      setAddressErrors(errs);
      return;
    }

    try {
      setIsGeocoding(true);
      const address = buildAddressForGeocoding({
        street: homeAddress.street,
        streetNumber: homeAddress.streetNumber,
        building: homeAddress.building,
        apartment: homeAddress.apartment,
        city: homeAddress.city,
        county: homeAddress.county,
        postalCode: homeAddress.postalCode,
        country: homeAddress.country,
      });
      const coords = await geocodeAddress(address);
      if (coords) {
        setHomeAddress((prev) => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        setAddressErrors({});
        Alert.alert('Coordonate obținute', `Lat: ${coords.latitude.toFixed(6)}, Lng: ${coords.longitude.toFixed(6)}`);
      } else {
        setAddressErrors({
          street: 'Adresa nu a putut fi găsită',
          streetNumber: 'Verifică numărul',
          postalCode: 'Verifică codul poștal',
        });
        Alert.alert('Adresă invalidă', 'Adresa nu a putut fi găsită. Verifică strada, numărul și codul poștal.');
      }
    } catch (e: any) {
      console.error('[VetFind] Geocoding error:', e);
      Alert.alert('Eroare', e?.message || 'Nu s-au putut obține coordonatele.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSignUp = async () => {
    // Inline validation UX: keep user on same screen, preserve inputs,
    // highlight invalid fields and show what needs to be fixed.
    setSubmitAttempted(true);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });

    if (!isFormValid) {
      setSubmitError('Corectează erorile afișate cu roșu mai jos.');
      return;
    }

    setSubmitError('');
    try {
      setLoading(true);

      const signupData: any = {
        name: fullName,
        email: email.toLowerCase(),
        password,
        role,
      };

      // Include address data and urgency preference for pet owners
      if (role === 'user') {
        if (homeAddress.street?.trim()) {
          signupData.street = homeAddress.street.trim();
          signupData.street_number = homeAddress.streetNumber?.trim() || null;
          signupData.building = homeAddress.building?.trim() || null;
          signupData.apartment = homeAddress.apartment?.trim() || null;
          signupData.city = homeAddress.city?.trim() || null;
          signupData.county = homeAddress.county || null;
          signupData.postal_code = homeAddress.postalCode?.trim() || null;
          signupData.country = homeAddress.country?.trim() || 'Romania';
          signupData.latitude = homeAddress.latitude;
          signupData.longitude = homeAddress.longitude;
        }
        signupData.show_emergency_clinics = showEmergencyClinics;
      }

      await signup(signupData);

      // No need to navigate - AuthContext will handle it automatically
    } catch (error: any) {
      const rawMsg = String(error?.message || '').trim();
      const msgLower = rawMsg.toLowerCase();

      // Erori specifice: cont existent pentru email sau număr de telefon (afișate pe pagină cu text roșu)
      if (msgLower.includes('email already exists') || msgLower.includes('account with this email already exists') || msgLower.includes('this email already exists')) {
        setSubmitError('Există deja un cont pentru această adresă de email. Autentifică-te sau folosește alt email.');
      } else if (msgLower.includes('phone already exists') || msgLower.includes('număr de telefon') || msgLower.includes('this phone already exists')) {
        setSubmitError('Există deja un cont pentru acest număr de telefon. Autentifică-te sau folosește alt număr.');
      } else {
        setSubmitError(rawMsg || 'A apărut o eroare la înregistrare.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength === 0) return '#e0e0e0';
    if (passwordStrength <= 2) return '#ff4444';
    if (passwordStrength <= 3) return '#ffaa00';
    if (passwordStrength <= 4) return '#00aa00';
    return '#00dd00';
  };

  const getPasswordStrengthWidth = (): string => {
    return `${(passwordStrength / 5) * 100}%`;
  };

  // React Native expects numeric width while web can accept string percentages.
  const getPasswordStrengthWidthValue = (): any => {
    if (Platform.OS === 'web') return getPasswordStrengthWidth();
    return `${(passwordStrength / 5) * 100}%` as any;
  };

  return (
    <LinearGradient
      colors={['#f5f3ff', '#ede9fe', '#f5f3ff']}
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
              {/* Decorative Floating Paw Prints */}
              <View style={styles.floatingPawsContainer}>
                <Ionicons name="paw" size={30} color="rgba(139, 92, 246, 0.1)" style={styles.floatingPaw1} />
                <Ionicons name="paw" size={24} color="rgba(167, 139, 250, 0.12)" style={styles.floatingPaw2} />
                <Ionicons name="paw" size={36} color="rgba(139, 92, 246, 0.08)" style={styles.floatingPaw3} />
                <Ionicons name="paw" size={28} color="rgba(167, 139, 250, 0.1)" style={styles.floatingPaw4} />
                <Ionicons name="paw" size={32} color="rgba(139, 92, 246, 0.09)" style={styles.floatingPaw5} />
                <Ionicons name="paw" size={26} color="rgba(167, 139, 250, 0.11)" style={styles.floatingPaw6} />
              </View>

              <View style={styles.cardContainer}>
                <View style={styles.content}>
              {/* Logo with Paw Icon */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#8b5cf6', '#a78bfa']}
                  style={styles.logoGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="paw" size={44} color="#ffffff" />
                </LinearGradient>
                {/* Small decorative paws around logo */}
                <Ionicons name="paw" size={16} color="rgba(139, 92, 246, 0.3)" style={styles.decorativePaw1} />
                <Ionicons name="paw" size={14} color="rgba(167, 139, 250, 0.3)" style={styles.decorativePaw2} />
              </View>

              {/* Title */}
              <Text style={styles.title}>Creează cont</Text>
              <Text style={styles.subtitle}>🐾 Găsește cel mai bun veterinar pentru animalul tău! 🐾</Text>

              {/* Full Name Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#8b5cf6" style={styles.inputIcon} />
                  <Text style={styles.inputLabel}>Nume complet</Text>
                </View>
                <TextInput
                    style={[styles.input, shouldShowError('fullName') && !!errors.fullName && styles.inputError]}
                  placeholder="Ion Popescu"
                  placeholderTextColor="#a0a0a0"
                  value={fullName}
                    onChangeText={(t) => {
                      setFullName(t);
                      if (!touched.fullName) setTouched((p) => ({ ...p, fullName: true }));
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                  {shouldShowError('fullName') && !!errors.fullName && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="close-circle" size={14} color="#ff4444" />
                      <Text style={styles.errorText}>{errors.fullName}</Text>
                    </View>
                  )}
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#8b5cf6" style={styles.inputIcon} />
                  <Text style={styles.inputLabel}>Adresă email</Text>
                </View>
                <TextInput
                    style={[styles.input, shouldShowError('email') && !!errors.email && styles.inputError]}
                  placeholder="email@domeniu.com"
                  placeholderTextColor="#a0a0a0"
                  value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (submitError) setSubmitError('');
                      if (!touched.email) setTouched((p) => ({ ...p, email: true }));
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                  {shouldShowError('email') && !!errors.email && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="close-circle" size={14} color="#ff4444" />
                      <Text style={styles.errorText}>{errors.email}</Text>
                    </View>
                  )}
              </View>

              {/* Role Selection */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-circle-outline" size={20} color="#8b5cf6" style={styles.inputIcon} />
                  <Text style={styles.inputLabel}>Sunt</Text>
                </View>
                <TouchableOpacity
                  style={styles.roleSelector}
                  onPress={() => setShowRolePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.roleSelectorText}>
                    {role === 'user' ? 'Stăpân de animal' : 'Clinica veterinară'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#8b5cf6" />
                </TouchableOpacity>
              </View>

              {/* Role Picker Modal */}
              <Modal
                visible={showRolePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                  blurActiveElementIfWeb();
                  setShowRolePicker(false);
                }}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => {
                    blurActiveElementIfWeb();
                    setShowRolePicker(false);
                  }}
                >
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Alege rolul</Text>

                    <TouchableOpacity
                      style={[
                        styles.roleOption,
                        role === 'user' && styles.roleOptionSelected
                      ]}
                      onPress={() => {
                        blurActiveElementIfWeb();
                        setRole('user');
                        setShowRolePicker(false);
                      }}
                    >
                      <Ionicons
                        name="paw"
                        size={24}
                        color={role === 'user' ? '#8b5cf6' : '#666666'}
                      />
                      <View style={styles.roleOptionText}>
                        <Text style={[
                          styles.roleOptionTitle,
                          role === 'user' && styles.roleOptionTitleSelected
                        ]}>
                          Stăpân de animal
                        </Text>
                        <Text style={styles.roleOptionDescription}>
                          Găsește cel mai bun veterinar pentru animalul tău
                        </Text>
                      </View>
                      {role === 'user' && (
                        <Ionicons name="checkmark-circle" size={24} color="#8b5cf6" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.roleOption,
                        role === 'vetcompany' && styles.roleOptionSelected
                      ]}
                      onPress={() => {
                        blurActiveElementIfWeb();
                        setRole('vetcompany');
                        setShowRolePicker(false);
                      }}
                    >
                      <Ionicons
                        name="medical"
                        size={24}
                        color={role === 'vetcompany' ? '#8b5cf6' : '#666666'}
                      />
                      <View style={styles.roleOptionText}>
                        <Text style={[
                          styles.roleOptionTitle,
                          role === 'vetcompany' && styles.roleOptionTitleSelected
                        ]}>
                          Clinica veterinară
                        </Text>
                        <Text style={styles.roleOptionDescription}>
                          Oferă servicii veterinare
                        </Text>
                      </View>
                      {role === 'vetcompany' && (
                        <Ionicons name="checkmark-circle" size={24} color="#8b5cf6" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalCloseButton}
                      onPress={() => {
                        blurActiveElementIfWeb();
                        setShowRolePicker(false);
                      }}
                    >
                      <Text style={styles.modalCloseButtonText}>Anulare</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* Home Address Section - Only for Pet Owners (right after Role) */}
              {role === 'user' && (
                <View style={styles.addressSection}>
                  <View style={styles.addressHeader}>
                    <Ionicons name="home-outline" size={22} color="#8b5cf6" />
                    <Text style={styles.addressTitle}>Adresa de acasă</Text>
                    <Text style={styles.addressOptional}>(opțional)</Text>
                  </View>
                  <Text style={styles.addressDescription}>
                    Adaugă adresa ta pentru a calcula distanța până la clinici
                  </Text>

                  <View style={styles.addressRow}>
                    <View style={styles.addressFlex3}>
                      <Text style={styles.addressLabel}>Strada</Text>
                      <TextInput
                        style={[styles.addressInput, !!addressErrors.street && styles.inputError]}
                        placeholder="Strada Mihai Eminescu"
                        placeholderTextColor="#a0a0a0"
                        value={homeAddress.street}
                        onChangeText={(t) => updateAddress('street', t)}
                      />
                      {!!addressErrors.street && (
                        <Text style={styles.addressErrorText}>{addressErrors.street}</Text>
                      )}
                    </View>
                    <View style={styles.addressFlex1}>
                      <Text style={styles.addressLabel}>Nr.</Text>
                      <TextInput
                        style={[styles.addressInput, !!addressErrors.streetNumber && styles.inputError]}
                        placeholder="15"
                        placeholderTextColor="#a0a0a0"
                        value={homeAddress.streetNumber}
                        onChangeText={(t) => updateAddress('streetNumber', t)}
                      />
                      {!!addressErrors.streetNumber && (
                        <Text style={styles.addressErrorText}>{addressErrors.streetNumber}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.addressRow}>
                    <View style={styles.addressHalf}>
                      <Text style={styles.addressLabel}>Bloc (opțional)</Text>
                      <TextInput
                        style={styles.addressInput}
                        placeholder="A2"
                        placeholderTextColor="#a0a0a0"
                        value={homeAddress.building}
                        onChangeText={(t) => updateAddress('building', t)}
                      />
                    </View>
                    <View style={styles.addressHalf}>
                      <Text style={styles.addressLabel}>Apartament (opțional)</Text>
                      <TextInput
                        style={styles.addressInput}
                        placeholder="23"
                        placeholderTextColor="#a0a0a0"
                        value={homeAddress.apartment}
                        onChangeText={(t) => updateAddress('apartment', t)}
                      />
                    </View>
                  </View>

                  <View style={styles.addressField}>
                    <CountyPicker
                      value={homeAddress.county}
                      onChange={handleCountyChange}
                      error={addressErrors.county}
                      disabled={false}
                    />
                  </View>

                  <View style={styles.addressField}>
                    <LocalityPicker
                      county={homeAddress.county}
                      value={homeAddress.city}
                      onChange={(locality) => updateAddress('city', locality)}
                      error={addressErrors.city}
                      disabled={false}
                    />
                  </View>

                  <View style={styles.addressField}>
                    <Text style={styles.addressLabel}>Cod Poștal</Text>
                    <TextInput
                      style={[styles.addressInput, !!addressErrors.postalCode && styles.inputError]}
                      placeholder="010101"
                      placeholderTextColor="#a0a0a0"
                      value={homeAddress.postalCode}
                      onChangeText={(t) => updateAddress('postalCode', t)}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    {!!addressErrors.postalCode && (
                      <Text style={styles.addressErrorText}>{addressErrors.postalCode}</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.geocodeButton, isGeocoding && styles.geocodeButtonDisabled]}
                    onPress={geocodeHomeAddress}
                    disabled={isGeocoding}
                  >
                    {isGeocoding ? (
                      <ActivityIndicator size="small" color="#8b5cf6" />
                    ) : (
                      <>
                        <Ionicons name="location-outline" size={18} color="#8b5cf6" />
                        <Text style={styles.geocodeButtonText}>Obține coordonate din adresă</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {homeAddress.latitude != null && homeAddress.longitude != null && (
                    <View style={styles.coordsContainer}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={styles.coordsText}>
                        Coordonate: {homeAddress.latitude.toFixed(6)}, {homeAddress.longitude.toFixed(6)}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.urgencyCheckRow}
                    onPress={() => setShowEmergencyClinics((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, showEmergencyClinics && styles.checkboxChecked]}>
                      {showEmergencyClinics && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={styles.urgencyCheckLabel}>
                      Arată clinicile disponibile în regim de urgență când sunt închise
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#8b5cf6" style={styles.inputIcon} />
                  <Text style={styles.inputLabel}>Parolă</Text>
                  {password.length > 0 && (
                    <View style={styles.strengthIndicator}>
                      <View style={styles.strengthBar}>
                        <View
                          style={[
                            styles.strengthFill,
                            {
                                width: getPasswordStrengthWidthValue(),
                              backgroundColor: getPasswordStrengthColor()
                            }
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      shouldShowError('password') && !!errors.password && styles.inputError,
                    ]}
                    placeholder="••••••••••••"
                    placeholderTextColor="#a0a0a0"
                    value={password}
                    onChangeText={(t) => {
                      handlePasswordChange(t);
                      if (!touched.password) setTouched((p) => ({ ...p, password: true }));
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
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
                {password.length > 0 && (
                  <View style={styles.passwordRequirements}>
                    <Ionicons
                      name={passwordIssues.length === 0 ? 'checkmark-circle' : 'information-circle'}
                      size={14}
                      color={passwordIssues.length === 0 ? '#00aa00' : '#ffaa00'}
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        { color: passwordIssues.length === 0 ? '#00aa00' : '#999999' },
                      ]}
                    >
                      {passwordIssues.length === 0
                        ? 'Parola este ok'
                        : `Lipsesc: ${passwordIssues.join(', ')}`}
                    </Text>
                  </View>
                )}

                {shouldShowError('password') && !!errors.password && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="close-circle" size={14} color="#ff4444" />
                    <Text style={styles.errorText}>{errors.password}</Text>
                  </View>
                )}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#8b5cf6" style={styles.inputIcon} />
                  <Text style={styles.inputLabel}>Confirmă parola</Text>
                </View>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      shouldShowError('confirmPassword') && !!errors.confirmPassword && styles.inputError,
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor="#a0a0a0"
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      if (!touched.confirmPassword) setTouched((p) => ({ ...p, confirmPassword: true }));
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                      size={22}
                      color="#a0a0a0"
                    />
                  </TouchableOpacity>
                </View>
                {shouldShowError('confirmPassword') && !!errors.confirmPassword && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="close-circle" size={14} color="#ff4444" />
                    <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                  </View>
                )}
              </View>

              {submitError ? (
                <View style={styles.submitErrorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#dc2626" style={styles.errorIcon} />
                  <Text style={styles.submitErrorText}>{submitError}</Text>
                </View>
              ) : null}

              {/* Sign Up Button */}
              <TouchableOpacity
                style={styles.signUpButton}
                onPress={handleSignUp}
                activeOpacity={0.9}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#a78bfa']}
                  style={styles.signUpButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Text style={styles.signUpButtonText}>Înregistrare</Text>
                      <Ionicons name="arrow-forward" size={20} color="#ffffff" style={styles.arrowIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Ai deja cont? </Text>
                <TouchableOpacity onPress={() => navigation?.navigate('Login')}>
                  <Text style={styles.loginLink}>Autentificare</Text>
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
    top: '8%',
    left: '10%',
    transform: [{ rotate: '-15deg' }],
  },
  floatingPaw2: {
    position: 'absolute',
    top: '12%',
    right: '10%',
    transform: [{ rotate: '25deg' }],
  },
  floatingPaw3: {
    position: 'absolute',
    top: '40%',
    left: '6%',
    transform: [{ rotate: '10deg' }],
  },
  floatingPaw4: {
    position: 'absolute',
    bottom: '25%',
    left: '8%',
    transform: [{ rotate: '-20deg' }],
  },
  floatingPaw5: {
    position: 'absolute',
    top: '55%',
    right: '7%',
    transform: [{ rotate: '15deg' }],
  },
  floatingPaw6: {
    position: 'absolute',
    bottom: '18%',
    right: '12%',
    transform: [{ rotate: '-10deg' }],
  },
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    boxShadow: '0 10px 20px rgba(124, 58, 237, 0.08)',
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    maxWidth: 420,
    width: '100%',
    marginHorizontal: 20,
    zIndex: 10,
  },
  content: {
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 25,
    position: 'relative',
  },
  decorativePaw1: {
    position: 'absolute',
    top: -10,
    right: 80,
    transform: [{ rotate: '-25deg' }],
  },
  decorativePaw2: {
    position: 'absolute',
    top: -8,
    left: 82,
    transform: [{ rotate: '20deg' }],
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)',
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8b5cf6',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  inputIcon: {
    marginRight: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  strengthIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -5 }],
  },
  strengthBar: {
    width: 60,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  inputError: {
    borderColor: '#ff4444',
    borderWidth: 1.5,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
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
  passwordRequirements: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  requirementText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginLeft: 6,
  },
  submitErrorContainer: {
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
  submitErrorText: {
    flex: 1,
    fontSize: 15,
    color: '#dc2626',
    fontWeight: '500',
  },
  signUpButton: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(139, 92, 246, 0.3)',
    elevation: 6,
  },
  signUpButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  signUpButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginText: {
    fontSize: 14,
    color: '#666666',
  },
  loginLink: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: 'bold',
  },
  roleSelector: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  roleSelectorText: {
    fontSize: 16,
    color: '#333333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    marginBottom: 12,
  },
  roleOptionSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
  },
  roleOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  roleOptionTitleSelected: {
    color: '#8b5cf6',
  },
  roleOptionDescription: {
    fontSize: 13,
    color: '#666666',
  },
  modalCloseButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  // Address section styles
  addressSection: {
    marginTop: 10,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
  },
  addressOptional: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  addressDescription: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 18,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  addressFlex1: {
    flex: 1,
  },
  addressFlex3: {
    flex: 3,
  },
  addressHalf: {
    flex: 1,
  },
  addressField: {
    marginBottom: 12,
  },
  addressLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginBottom: 6,
  },
  addressInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  addressErrorText: {
    fontSize: 11,
    color: '#ff4444',
    marginTop: 4,
  },
  geocodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
    marginTop: 4,
  },
  geocodeButtonDisabled: {
    opacity: 0.6,
  },
  geocodeButtonText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '600',
    marginLeft: 8,
  },
  coordsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
  },
  coordsText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  urgencyCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#8b5cf6',
  },
  urgencyCheckLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333333',
    lineHeight: 18,
  },
});

export default SignUpScreen;
