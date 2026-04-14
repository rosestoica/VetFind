import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { CountyPicker } from '../components/FormComponents/CountyPicker';
import { LocalityPicker } from '../components/FormComponents/LocalityPicker';
import { CountyCode } from '../constants/romania';
import { validateRomanianPostalCode, validateRomanianPhone } from '../utils/romanianValidation';
import { buildAddressForGeocoding, geocodeAddress } from '../utils/geocoding';

type HomeAddressForm = {
  phone: string;
  street: string;
  streetNumber: string;
  building: string;
  apartment: string;
  city: string;
  county: CountyCode | '';
  postalCode: string;
  country: string;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export const UserSettingsScreen = () => {
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('UserDashboard' as never);
    }
  };

  const initial = useMemo<HomeAddressForm>(
    () => ({
      phone: String(user?.phone ?? ''),
      street: String(user?.street ?? ''),
      streetNumber: String(user?.street_number ?? ''),
      building: String(user?.building ?? ''),
      apartment: String(user?.apartment ?? ''),
      city: String(user?.city ?? ''),
      county: (user?.county as any) ?? '',
      postalCode: String(user?.postal_code ?? ''),
      country: String(user?.country ?? 'Romania'),
    }),
    [user],
  );

  const [form, setForm] = useState<HomeAddressForm>(initial);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const setField = (k: keyof HomeAddressForm, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }));
  };

  const validateAddress = (): boolean => {
    const e: Record<string, string> = {};
    const phoneTrim = form.phone.trim();
    if (phoneTrim && !validateRomanianPhone(phoneTrim)) {
      e.phone = 'Format invalid (+40 … sau 07…)';
    }
    if (!form.street.trim()) e.street = 'Strada este obligatorie';
    if (!form.streetNumber.trim()) e.streetNumber = 'Numărul este obligatoriu';
    if (!form.city.trim()) e.city = 'Localitatea este obligatorie';
    if (!String(form.county || '').trim()) e.county = 'Județul este obligatoriu';
    if (!form.postalCode.trim()) e.postalCode = 'Codul poștal este obligatoriu';
    else if (!validateRomanianPostalCode(form.postalCode)) e.postalCode = 'Format invalid (6 cifre)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doGeocode = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (!validateAddress()) return null;
    try {
      setGeocoding(true);
      const address = buildAddressForGeocoding({
        street: form.street,
        streetNumber: form.streetNumber,
        building: form.building,
        apartment: form.apartment,
        city: form.city,
        county: form.county,
        postalCode: form.postalCode,
        country: form.country,
      });
      const coords = await geocodeAddress(address);
      if (!coords) {
        Alert.alert('Adresă invalidă', 'Adresa nu a putut fi găsită. Verifică strada, numărul și codul poștal.');
        return null;
      }
      return coords;
    } catch (e: any) {
      Alert.alert('Eroare', e?.message || 'Nu s-au putut obține coordonatele.');
      return null;
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    const coords = await doGeocode();
    if (!coords) return;

    try {
      setSaving(true);
      await updateUser({
        phone: form.phone.trim() || null,
        street: form.street.trim(),
        street_number: form.streetNumber.trim(),
        building: form.building.trim() || undefined,
        apartment: form.apartment.trim() || undefined,
        city: form.city.trim(),
        county: form.county || undefined,
        postal_code: form.postalCode.trim(),
        country: form.country.trim() || 'Romania',
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      setSnackMessage('Profilul a fost actualizat cu succes!');
      setSnackVisible(true);
    } catch (e: any) {
      setSnackMessage(e?.message || 'Nu s-a putut salva profilul');
      setSnackVisible(true);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredMsg}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.neutral[400]} />
          <Text style={styles.centeredMsgText}>Nu ești autentificat.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = getInitials(user.name || 'U');
  const hasCoords = typeof user.latitude === 'number' && typeof user.longitude === 'number';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Hero */}
        <LinearGradient
          colors={[...theme.gradients.bannerDuo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={styles.heroGradient}
        >
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.heroBody}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.heroName}>{user.name}</Text>
            <Text style={styles.heroEmail}>{user.email}</Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.roleBadge}>
                <MaterialCommunityIcons name="paw" size={14} color={theme.colors.primary.main} />
                <Text style={styles.roleBadgeText}>Pet Owner</Text>
              </View>
              <View style={styles.dateBadge}>
                <Ionicons name="calendar-outline" size={13} color={theme.colors.neutral[500]} />
                <Text style={styles.dateBadgeText}>Membru din {formatDate(user.created_at)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Contact Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="call-outline" size={18} color={theme.colors.primary.main} />
            </View>
            <Text style={styles.cardTitle}>Contact</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Numărul de telefon este afișat clinicilor la programările tale.
          </Text>
          <TextInput
            mode="outlined"
            label="Telefon"
            value={form.phone}
            onChangeText={(t) => setField('phone', t)}
            keyboardType="phone-pad"
            error={!!errors.phone}
            style={styles.input}
            left={<TextInput.Icon icon="phone-outline" />}
            outlineStyle={styles.inputOutline}
          />
          {!!errors.phone && <Text style={styles.err}>{errors.phone}</Text>}
        </View>

        {/* Address Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconCircle}>
              <Ionicons name="home-outline" size={18} color={theme.colors.primary.main} />
            </View>
            <Text style={styles.cardTitle}>Adresa de acasă</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Adresa este folosită pentru calculul distanței față de clinici.
          </Text>

          <TextInput
            mode="outlined"
            label="Strada"
            value={form.street}
            onChangeText={(t) => setField('street', t)}
            error={!!errors.street}
            style={styles.input}
            left={<TextInput.Icon icon="road-variant" />}
            outlineStyle={styles.inputOutline}
          />
          {!!errors.street && <Text style={styles.err}>{errors.street}</Text>}

          <View style={styles.row}>
            <TextInput
              mode="outlined"
              label="Număr"
              value={form.streetNumber}
              onChangeText={(t) => setField('streetNumber', t)}
              error={!!errors.streetNumber}
              style={[styles.input, styles.flex1]}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              mode="outlined"
              label="Bloc (opț.)"
              value={form.building}
              onChangeText={(t) => setField('building', t)}
              style={[styles.input, styles.flex1]}
              outlineStyle={styles.inputOutline}
            />
            <TextInput
              mode="outlined"
              label="Ap. (opț.)"
              value={form.apartment}
              onChangeText={(t) => setField('apartment', t)}
              style={[styles.input, styles.flex1]}
              outlineStyle={styles.inputOutline}
            />
          </View>
          {!!errors.streetNumber && <Text style={styles.err}>{errors.streetNumber}</Text>}

          <View style={styles.pickerWrap}>
            <CountyPicker
              value={form.county}
              onChange={(c) => setForm((p) => ({ ...p, county: c }))}
              error={errors.county}
              disabled={false}
            />
          </View>

          <View style={styles.pickerWrap}>
            <LocalityPicker
              county={form.county}
              value={form.city}
              onChange={(locality) => setField('city', locality)}
              error={errors.city}
              disabled={false}
            />
          </View>

          <TextInput
            mode="outlined"
            label="Cod poștal"
            value={form.postalCode}
            onChangeText={(t) => setField('postalCode', t)}
            keyboardType="number-pad"
            maxLength={6}
            error={!!errors.postalCode}
            style={styles.input}
            left={<TextInput.Icon icon="mailbox-outline" />}
            outlineStyle={styles.inputOutline}
          />
          {!!errors.postalCode && <Text style={styles.err}>{errors.postalCode}</Text>}

          {hasCoords && (
            <View style={styles.coordsBox}>
              <MaterialCommunityIcons name="map-marker-check-outline" size={18} color={theme.colors.accent.main} />
              <Text style={styles.coordsText}>
                Coordonate salvate: {user.latitude!.toFixed(5)}, {user.longitude!.toFixed(5)}
              </Text>
            </View>
          )}
        </View>

        {/* Save Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || geocoding}
            activeOpacity={0.8}
            style={styles.saveBtn}
          >
            <LinearGradient
              colors={[...theme.gradients.bannerDuo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              {saving || geocoding ? (
                <Button loading textColor="#FFFFFF" style={styles.saveBtnLoading}>
                  {geocoding ? 'Se verifică adresa…' : 'Se salvează…'}
                </Button>
              ) : (
                <View style={styles.saveBtnInner}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Salvează modificările</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
        action={{ label: 'OK', onPress: () => setSnackVisible(false) }}
      >
        {snackMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centeredMsg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  centeredMsgText: {
    fontSize: 16,
    color: theme.colors.neutral[600],
  },

  heroGradient: {
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 36,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBody: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 14,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary.main,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dateBadgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },

  card: {
    backgroundColor: theme.colors.surface.card,
    marginHorizontal: theme.spacing.lg,
    marginTop: -16,
    marginBottom: 16,
    borderRadius: 18,
    padding: 20,
    ...theme.shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  cardIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.neutral[500],
    marginBottom: 14,
    marginLeft: 44,
  },
  input: {
    backgroundColor: theme.colors.surface.cream,
    marginBottom: 6,
  },
  inputOutline: {
    borderRadius: 12,
  },
  err: {
    color: theme.colors.error.main,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex1: {
    flex: 1,
  },
  pickerWrap: {
    marginTop: 4,
    marginBottom: 2,
  },
  coordsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.accent[50],
    borderWidth: 1,
    borderColor: theme.colors.accent[200],
  },
  coordsText: {
    fontSize: 13,
    color: theme.colors.accent[700],
    fontWeight: '600',
    flex: 1,
  },

  actionsCard: {
    marginHorizontal: theme.spacing.lg,
    marginTop: 4,
  },
  saveBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...theme.shadows.primaryMd,
  },
  saveBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  saveBtnLoading: {
    backgroundColor: 'transparent',
  },
});

export default UserSettingsScreen;
