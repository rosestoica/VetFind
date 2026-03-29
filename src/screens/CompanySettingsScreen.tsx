import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { theme } from '../theme';
import { BackHeader } from '../components/BackHeader';
import { CountyPicker } from '../components/FormComponents/CountyPicker';
import { LocalityPicker } from '../components/FormComponents/LocalityPicker';
import { OpeningHoursPicker } from '../components/FormComponents/OpeningHoursPicker';
import { CountyCode } from '../constants/romania';
import { validateRomanianPostalCode, validateRomanianPhone, validateCUI } from '../utils/romanianValidation';
import { buildAddressForGeocoding, geocodeAddress } from '../utils/geocoding';
import { useCompany } from '../context/CompanyContext';
import type { OpeningHours } from '../types/company.types';

const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday: { open: '09:00', close: '17:00', closed: false },
  tuesday: { open: '09:00', close: '17:00', closed: false },
  wednesday: { open: '09:00', close: '17:00', closed: false },
  thursday: { open: '09:00', close: '17:00', closed: false },
  friday: { open: '09:00', close: '17:00', closed: false },
  saturday: { open: '09:00', close: '13:00', closed: false },
  sunday: { open: null, close: null, closed: true },
};

type CompanySettingsForm = {
  name: string;
  phone: string;
  cui: string;
  description: string;
  opening_hours: OpeningHours;

  street: string;
  streetNumber: string;
  building: string;
  apartment: string;
  city: string;
  county: CountyCode | '';
  postalCode: string;
  country: string;
};

export const CompanySettingsScreen = () => {
  const { company, updateCompany } = useCompany();

  const initial = useMemo<CompanySettingsForm>(() => {
    const hours = company?.opening_hours;
    const mergedHours: OpeningHours = {
      monday: hours?.monday ?? DEFAULT_OPENING_HOURS.monday,
      tuesday: hours?.tuesday ?? DEFAULT_OPENING_HOURS.tuesday,
      wednesday: hours?.wednesday ?? DEFAULT_OPENING_HOURS.wednesday,
      thursday: hours?.thursday ?? DEFAULT_OPENING_HOURS.thursday,
      friday: hours?.friday ?? DEFAULT_OPENING_HOURS.friday,
      saturday: hours?.saturday ?? DEFAULT_OPENING_HOURS.saturday,
      sunday: hours?.sunday ?? DEFAULT_OPENING_HOURS.sunday,
    };
    return {
      name: String(company?.name ?? ''),
      phone: String(company?.phone ?? ''),
      cui: String((company as any)?.cui ?? ''),
      description: String(company?.description ?? ''),
      opening_hours: mergedHours,

      street: String((company as any)?.street ?? company?.address ?? ''),
      streetNumber: String((company as any)?.street_number ?? ''),
      building: String((company as any)?.building ?? ''),
      apartment: String((company as any)?.apartment ?? ''),
      city: String(company?.city ?? ''),
      county: ((company as any)?.county ?? (company as any)?.state ?? '') as any,
      postalCode: String((company as any)?.postal_code ?? (company as any)?.zip_code ?? ''),
      country: 'Romania',
    };
  }, [company]);

  const [form, setForm] = useState<CompanySettingsForm>(initial);

  // Completó formularul cu valorile din company când acestea se încarcă sau se actualizează
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const setField = (k: keyof CompanySettingsForm, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (!form.name.trim()) e.name = 'Denumirea clinicii este obligatorie';
    if (!form.phone.trim()) e.phone = 'Numărul de telefon este obligatoriu';
    else if (!validateRomanianPhone(form.phone)) e.phone = 'Format invalid (ex: +40 7xx xxx xxx)';
    if (form.cui.trim() && !validateCUI(form.cui)) e.cui = 'CUI invalid';
    if (form.description.length > 2000) e.description = 'Descrierea nu poate depăși 2000 de caractere';

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
    if (!validate()) return null;
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
        Alert.alert('Adresa invalida', 'Adresa invalida');
        return null;
      }
      return coords;
    } catch (_e: any) {
      Alert.alert('Adresa invalida', 'Adresa invalida');
      return null;
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!company) {
      setSnackMessage('Nu există profil de clinică încă.');
      setSnackVisible(true);
      return;
    }

    if (!validate()) return;

    try {
      setSaving(true);

      const addressLine = [form.street.trim(), form.streetNumber.trim()].filter(Boolean).join(' ');
      const coords = await doGeocode();

      const payload: Parameters<typeof updateCompany>[1] = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        cui: form.cui.trim() || undefined,
        description: form.description.trim() || undefined,
        opening_hours: form.opening_hours,

        street: form.street.trim(),
        street_number: form.streetNumber.trim(),
        building: form.building.trim() || undefined,
        apartment: form.apartment.trim() || undefined,
        city: form.city.trim(),
        county: (form.county as any) || undefined,
        postal_code: form.postalCode.trim(),

        address: addressLine,
        state: (form.county as any) || undefined,
        zip_code: form.postalCode.trim(),
      };

      if (coords) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
      }
      // Când geocoding eșuează, nu trimitem lat/lng ca să nu ștergem coordonatele existente

      await updateCompany(payload);

      setSnackMessage('Setările clinicii au fost actualizate');
      setSnackVisible(true);
    } catch (e: any) {
      setSnackMessage(e?.message || 'Nu s-au putut salva setările');
      setSnackVisible(true);
    } finally {
      setSaving(false);
    }
  };

  if (!company) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text>Nu există profil de clinică.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="Setări clinică" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Date clinică</Text>

        <TextInput
          mode="outlined"
          label="Denumire clinică"
          value={form.name}
          onChangeText={(t) => setField('name', t)}
          error={!!errors.name}
          style={styles.input}
        />
        {!!errors.name && <Text style={styles.err}>{errors.name}</Text>}

        <TextInput
          mode="outlined"
          label="Telefon"
          value={form.phone}
          onChangeText={(t) => setField('phone', t)}
          error={!!errors.phone}
          style={styles.input}
        />
        {!!errors.phone && <Text style={styles.err}>{errors.phone}</Text>}

        <TextInput
          mode="outlined"
          label="CUI (opțional)"
          value={form.cui}
          onChangeText={(t) => setField('cui', t)}
          error={!!errors.cui}
          style={styles.input}
        />
        {!!errors.cui && <Text style={styles.err}>{errors.cui}</Text>}

        <Text style={styles.sectionTitle}>Descriere</Text>
        <Text style={styles.sectionSubtitle}>
          Prezentare scurtă a clinicii (opțional, max. 2000 caractere).
        </Text>
        <TextInput
          mode="outlined"
          label="Descriere clinică"
          value={form.description}
          onChangeText={(t) => setField('description', t)}
          error={!!errors.description}
          multiline
          numberOfLines={4}
          style={[styles.input, styles.descriptionInput]}
        />
        {!!errors.description && <Text style={styles.err}>{errors.description}</Text>}

        <Text style={styles.sectionTitle}>Program</Text>
        <Text style={styles.sectionSubtitle}>
          Orele de funcționare pentru fiecare zi. Modificați și salvați.
        </Text>
        <View style={styles.openingHoursWrap}>
          <OpeningHoursPicker
            value={form.opening_hours}
            onChange={(hours) => setForm((p) => ({ ...p, opening_hours: hours }))}
          />
        </View>

        <Text style={styles.sectionTitle}>Adresă (cu actualizare coordonate)</Text>
        <Text style={styles.sectionSubtitle}>
          La salvare se recalculează automat coordonatele clinicii.
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
          <Button mode="contained" onPress={handleSave} loading={saving || geocoding} disabled={saving || geocoding}>
            Salvează
          </Button>
        </View>

        <View style={styles.coords}>
          <Text style={styles.coordsLabel}>Coordonate curente:</Text>
          <Text style={styles.coordsValue}>
            {typeof (company as any).latitude === 'number' && typeof (company as any).longitude === 'number'
              ? `${Number((company as any).latitude).toFixed(6)}, ${Number((company as any).longitude).toFixed(6)}`
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
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.neutral[800], marginTop: 8 },
  sectionSubtitle: { color: theme.colors.neutral[600], marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface.cream },
  descriptionInput: { minHeight: 100 },
  err: { color: theme.colors.error.main, fontSize: 12, marginTop: -6 },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  picker: { marginTop: 4 },
  openingHoursWrap: { marginTop: 4, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'space-between' },
  coords: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface.cream, borderWidth: 1, borderColor: theme.colors.surface.border },
  coordsLabel: { color: theme.colors.neutral[600], fontWeight: '700' },
  coordsValue: { color: theme.colors.neutral[900], marginTop: 4, fontWeight: '700' },
});

export default CompanySettingsScreen;

