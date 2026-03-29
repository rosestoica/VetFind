import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Text, HelperText } from 'react-native-paper';
import { ImageUploader } from '../../components/FormComponents/ImageUploader';
import { RomanianPhoneInput } from '../../components/FormComponents/RomanianPhoneInput';
import { ScrollContainer } from '../../components/FormComponents/ScrollContainer';
import { FormSection } from '../../components/FormComponents/FormSection';
import { ContextualHelp } from '../../components/FormComponents/ContextualHelp';
import { Step1FormData } from '../../types/company.types';
import { useTheme } from '../../hooks/useTheme';

export interface Step1BasicInfoProps {
  data: Partial<Step1FormData>;
  onChange: (data: Partial<Step1FormData>) => void;
  errors?: { [key: string]: string };
}

/**
 * Step 1: Basic Info (Phase 3 Redesign - Card-Based Sections)
 * - Company Name (required, 3-100 chars)
 * - Logo Upload (optional, camera + gallery)
 * - Business Email (required, email validation)
 * - Phone Number (required, format validation)
 * - CUI (optional, with contextual help)
 * - Short Description (optional, 100 char limit)
 */
export const Step1BasicInfo = ({ data, onChange, errors = {} }: Step1BasicInfoProps) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState<{ [key: string]: boolean }>({});

  const updateField = (field: keyof Step1FormData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleFocus = (field: string) => {
    setIsFocused({ ...isFocused, [field]: true });
  };

  const handleBlur = (field: string) => {
    setIsFocused({ ...isFocused, [field]: false });
  };

  return (
    <ScrollContainer>
      {/* Header */}
      <View style={[styles.header, { marginBottom: 24 }]}>
        <Text variant="headlineMedium" style={[styles.title, { color: colors.neutral[900] }]}>
          Spune-ne despre clinica ta
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.neutral[600] }]}>
          Începe cu informațiile de bază pentru ca proprietarii de animale să te poată recunoaște și contacta
        </Text>
      </View>

      {/* Logo Upload Section */}
      <FormSection
        title="Logo-ul clinicii"
        subtitle="Încarcă logo-ul clinicii tale (opțional)"
        icon="business-outline"
      >
        <ImageUploader
          value={data.logo_url || null}
          onChange={(uri) => updateField('logo_url', uri)}
          placeholder="Încarcă logo"
          aspectRatio={[1, 1]}
          maxWidth={150}
          maxHeight={150}
          centerAlign={true}
        />
        {errors.logo_url && (
          <HelperText type="error" visible={true}>
            {errors.logo_url}
          </HelperText>
        )}
      </FormSection>

      {/* Basic Information Section */}
      <FormSection
        title="Informații de bază"
        subtitle="Nume companie, email și telefon"
        icon="information-circle-outline"
      >
        {/* Company Name */}
        <View style={styles.inputGroup}>
          <TextInput
            label="Nume companie *"
            value={data.name || ''}
            onChangeText={(text) => updateField('name', text)}
            onFocus={() => handleFocus('name')}
            onBlur={() => handleBlur('name')}
            mode="outlined"
            error={!!errors.name}
            maxLength={100}
            placeholder="ex., Clinica Veterinară Happy Paws"
            style={[styles.input, { backgroundColor: colors.surface.cream }]}
            outlineColor={colors.neutral[300]}
            activeOutlineColor={colors.primary.main}
            accessibilityLabel="Nume companie"
            accessibilityHint="Introdu numele clinicii tale veterinare (3-100 caractere)"
          />
          <HelperText type="error" visible={!!errors.name}>
            {errors.name || ' '}
          </HelperText>
          <HelperText type="info" visible={!errors.name && (isFocused.name || !!data.name)}>
            {data.name ? `${data.name.length}/100 caractere` : '3-100 caractere necesare'}
          </HelperText>
        </View>

        {/* Business Email */}
        <View style={styles.inputGroup}>
          <TextInput
            label="Email de contact *"
            value={data.email || ''}
            onChangeText={(text) => updateField('email', text)}
            onFocus={() => handleFocus('email')}
            onBlur={() => handleBlur('email')}
            mode="outlined"
            error={!!errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="contact@happypaws.com"
            style={[styles.input, { backgroundColor: colors.surface.cream }]}
            outlineColor={colors.neutral[300]}
            activeOutlineColor={colors.primary.main}
            accessibilityLabel="Email de contact"
            accessibilityHint="Introdu adresa de email a clinicii tale"
          />
          <HelperText type="error" visible={!!errors.email}>
            {errors.email || ' '}
          </HelperText>
        </View>

        {/* Phone Number */}
        <View style={styles.inputGroup}>
          <RomanianPhoneInput
            value={data.phone || ''}
            onChange={(phone) => updateField('phone', phone)}
            error={errors.phone}
            disabled={false}
          />
        </View>
      </FormSection>

      {/* Tax Information Section */}
      <FormSection
        title="Informații fiscale"
        subtitle="Identificare companie română (opțional)"
        icon="document-text-outline"
      >
        {/* CUI with Contextual Help */}
        <View style={styles.inputGroup}>
          <View style={styles.inputWithHelp}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="CUI (Cod Unic de Înregistrare)"
                value={data.cui || ''}
                onChangeText={(text) => updateField('cui', text)}
                onFocus={() => handleFocus('cui')}
                onBlur={() => handleBlur('cui')}
                mode="outlined"
                error={!!errors.cui}
                placeholder="RO12345678 sau 12345678"
                style={[styles.input, { backgroundColor: colors.surface.cream }]}
                outlineColor={colors.neutral[300]}
                activeOutlineColor={colors.primary.main}
                accessibilityLabel="CUI"
                accessibilityHint="Opțional - Cod fiscal român (poate fi adăugat mai târziu)"
              />
            </View>
            <ContextualHelp
              title="Format CUI"
              content="Introdu codul unic de identificare al companiei tale (CUI). Acesta poate fi cu sau fără prefixul 'RO'."
              examples={['RO12345678', '12345678']}
            />
          </View>
          <HelperText type="error" visible={!!errors.cui}>
            {errors.cui || ' '}
          </HelperText>
          <HelperText type="info" visible={!errors.cui}>
            Opțional - poate fi adăugat mai târziu
          </HelperText>
        </View>
      </FormSection>

      {/* Additional Information Section */}
      <FormSection
        title="Informații suplimentare"
        subtitle="Scurtă descriere a clinicii tale (opțional)"
        icon="text-outline"
      >
        {/* Short Description */}
        <View style={styles.inputGroup}>
          <TextInput
            label="Descriere scurtă (Opțional)"
            value={data.description || ''}
            onChangeText={(text) => updateField('description', text)}
            onFocus={() => handleFocus('description')}
            onBlur={() => handleBlur('description')}
            mode="outlined"
            error={!!errors.description}
            multiline
            numberOfLines={3}
            maxLength={100}
            placeholder="Scurtă descriere a clinicii tale (max 100 caractere)"
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface.cream }]}
            outlineColor={colors.neutral[300]}
            activeOutlineColor={colors.primary.main}
            accessibilityLabel="Descriere scurtă"
            accessibilityHint="Descriere scurtă opțională a clinicii tale"
          />
          <HelperText type="error" visible={!!errors.description}>
            {errors.description || ' '}
          </HelperText>
          <HelperText type="info" visible={!errors.description && (isFocused.description || !!data.description)}>
            {data.description ? `${data.description.length}/100 caractere` : 'Opțional, max 100 caractere'}
          </HelperText>
        </View>
      </FormSection>

      {/* Required Fields Notice */}
      <View style={[styles.notice, { backgroundColor: colors.primary[50], borderLeftColor: colors.primary.main }]}>
        <Text variant="bodySmall" style={[styles.noticeText, { color: colors.neutral[700] }]}>
          * Câmpuri obligatorii
        </Text>
      </View>
    </ScrollContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    // Removed hardcoded marginBottom, now inline
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputWithHelp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    // Background color now dynamic via theme
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notice: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  noticeText: {
    fontStyle: 'italic',
  },
});
