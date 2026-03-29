import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { BackHeader } from '../components/BackHeader';
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

  const initial = useMemo<HomeAddressForm>(() => ({
    phone: String(user?.phone ?? ''),
    street: String(user?.street ?? ''),
    streetNumber: String(user?.street_number ?? ''),
    building: String(user?.building ?? ''),
    apartment: String(user?.apartment ?? ''),
    city: String(user?.city ?? ''),
    county: (user?.county as any) ?? '',
    postalCode: String(user?.postal_code ?? ''),
    country: String(user?.country ?? 'Romania'),
  }), [user]);

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
      setSnackMessage('Adresa de acasă a fost actualizată');
      setSnackVisible(true);
    } catch (e: any) {
      setSnackMessage(e?.message || 'Nu s-a putut salva adresa');
      setSnackVisible(true);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text>Nu ești autentificat.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="Setări" onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="settings-outline" size={22} color={theme.colors.primary.main} />
          <Text style={styles.title}>Setări</Text>
        </View>

        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.sectionSubtitle}>
          Numărul de telefon este afișat clinicilor la programările tale (opțional).
        </Text>
        <TextInput
          mode="outlined"
          label="Telefon (opțional)"
          value={form.phone}
          onChangeText={(t) => setField('phone', t)}
          keyboardType="phone-pad"
          error={!!errors.phone}
          style={styles.input}
        />
        {!!errors.phone && <Text style={styles.err}>{errors.phone}</Text>}

        <Text style={styles.sectionTitle}>Home Address</Text>
        <Text style={styles.sectionSubtitle}>
          Modifică adresa de acasă. La salvare se recalculează automat coordonatele.
        </Text>

        <TextInput
          mode="outlined"
          label="Strada"
          value={form.street}
          onChangeText={(t) => setField('street', t)}
          error={!!errors.street}
          style={styles.input}
        />
        {!!errors.street && <Text style={styles.err}>{errors.street}</Text>}

        <TextInput
          mode="outlined"
          label="Număr"
          value={form.streetNumber}
          onChangeText={(t) => setField('streetNumber', t)}
          error={!!errors.streetNumber}
          style={styles.input}
        />
        {!!errors.streetNumber && <Text style={styles.err}>{errors.streetNumber}</Text>}

        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label="Bloc (opțional)"
            value={form.building}
            onChangeText={(t) => setField('building', t)}
            style={[styles.input, styles.flex1]}
          />
          <TextInput
            mode="outlined"
            label="Apartament (opțional)"
            value={form.apartment}
            onChangeText={(t) => setField('apartment', t)}
            style={[styles.input, styles.flex1]}
          />
        </View>

        <View style={styles.picker}>
          <CountyPicker
            value={form.county}
            onChange={(c) => setForm((p) => ({ ...p, county: c }))}
            error={errors.county}
            disabled={false}
          />
        </View>

        <View style={styles.picker}>
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
        />
        {!!errors.postalCode && <Text style={styles.err}>{errors.postalCode}</Text>}

        <View style={styles.actions}>
          <Button mode="outlined" onPress={doGeocode} loading={geocoding} disabled={saving || geocoding}>
            Obține coordonate din adresă
          </Button>
          <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving || geocoding}>
            Salvează
          </Button>
        </View>

        <View style={styles.coords}>
          <Text style={styles.coordsLabel}>Coordonate curente:</Text>
          <Text style={styles.coordsValue}>
            {typeof user.latitude === 'number' && typeof user.longitude === 'number'
              ? `${user.latitude.toFixed(6)}, ${user.longitude.toFixed(6)}`
              : '—'}
          </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface.background },
  content: { padding: theme.spacing.lg, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.neutral[900] },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.neutral[800], marginTop: 8 },
  sectionSubtitle: { color: theme.colors.neutral[600], marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface.cream },
  err: { color: theme.colors.error.main, fontSize: 12, marginTop: -6 },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  picker: { marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'space-between' },
  coords: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface.cream, borderWidth: 1, borderColor: theme.colors.surface.border },
  coordsLabel: { color: theme.colors.neutral[600], fontWeight: '700' },
  coordsValue: { color: theme.colors.neutral[900], marginTop: 4, fontWeight: '700' },
});

export default UserSettingsScreen;

