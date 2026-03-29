import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, Image } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { BackHeader } from '../components/BackHeader';
import { ImageUploader } from '../components/FormComponents/ImageUploader';
import { MultipleImageUploader } from '../components/FormComponents/MultipleImageUploader';
import { WebPhotoUploader } from '../components/WebPhotoUploader';
import { ApiService } from '../services/api';
import { uploadCompanyLogoFromUri } from '../services/firebaseStorage';
import { useAuth } from '../context/AuthContext';
import { Company } from '../types/company.types';
import { theme } from '../theme';

export const ManagePhotosScreen = () => {
  const { accessToken } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      setIsLoading(true);
      const fetchedCompany = await ApiService.getMyCompany();
      setCompany(fetchedCompany);
    } catch (error) {
      console.error('Error loading company:', error);
      Alert.alert('Eroare', 'Nu s-au putut încărca datele companiei.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotosChange = (photos: string[]) => {
    // Update local state
    if (company) {
      setCompany({ ...company, photos });
    }
  };

  const handleWebUploadSuccess = (photoUrl: string) => {
    // Update local state when web upload succeeds
    if (company) {
      setCompany({ ...company, photos: [...(company.photos || []), photoUrl] });
    }
  };

  const handleWebDeleteSuccess = (photoUrl: string) => {
    // Update local state when web delete succeeds
    if (company) {
      setCompany({
        ...company,
        photos: (company.photos || []).filter(url => url !== photoUrl)
      });
    }
  };

  const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

  /** Dimensiuni permise pentru logo: min 100x100, max 2000x2000 pixeli */
  const LOGO_MIN = 100;
  const LOGO_MAX = 2000;

  const validateLogoDimensions = (uri: string): Promise<{ valid: boolean; width?: number; height?: number }> => {
    return new Promise((resolve) => {
      Image.getSize(
        uri,
        (width, height) => {
          const valid =
            width >= LOGO_MIN &&
            height >= LOGO_MIN &&
            width <= LOGO_MAX &&
            height <= LOGO_MAX;
          resolve({ valid, width, height });
        },
        () => resolve({ valid: false })
      );
    });
  };

  const handleLogoChange = async (uri: string | null) => {
    if (!company) return;
    if (uri === null) {
      try {
        await ApiService.request(`/companies/${company.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ logo_url: null }),
        });
        setCompany({ ...company, logo_url: undefined });
      } catch (e) {
        console.error('Error removing logo:', e);
        Alert.alert('Eroare', 'Nu s-a putut șterge logo-ul. Încearcă din nou.');
      }
      return;
    }
    const { valid, width, height } = await validateLogoDimensions(uri);
    if (!valid) {
      Alert.alert(
        'Dimensiuni nepermise',
        `Imaginea logo trebuie să aibă între ${LOGO_MIN}×${LOGO_MIN} și ${LOGO_MAX}×${LOGO_MAX} pixeli.${
          width != null && height != null
            ? ` Imaginea selectată: ${width}×${height} pixeli.`
            : ' Nu s-a putut citi imaginea.'
        }`
      );
      return;
    }
    try {
      setLogoUploading(true);
      const logoUrl = await uploadCompanyLogoFromUri(company.id, uri);
      await ApiService.request(`/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ logo_url: logoUrl }),
      });
      setCompany({ ...company, logo_url: logoUrl });
    } catch (e) {
      console.error('Error uploading logo:', e);
      Alert.alert('Eroare', (e as Error)?.message || 'Nu s-a putut încărca logo-ul. Încearcă din nou.');
    } finally {
      setLogoUploading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={styles.loadingText}>Se încarcă fotografiile...</Text>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Compania nu a fost găsită</Text>
      </View>
    );
  }

  // Resolve logo URL for display (Firebase URLs stay as-is; relative paths become absolute)
  const resolveLogoUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
    const origin = apiBase.replace(/\/api\/?$/i, '');
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${origin}${normalized}`;
  };

  const displayLogoUrl = resolveLogoUrl(company.logo_url);

  return (
    <View style={styles.wrapper}>
      <BackHeader title="Gestionează fotografiile companiei" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Change Logo - single image, shows current logo */}
      <View style={styles.logoSection}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Schimbă logo-ul
        </Text>
        <Text variant="bodySmall" style={styles.sectionSubtitle}>
          O singură imagine. Logo-ul apare pe cardurile companiei în aplicație.
        </Text>
        <View style={styles.logoUploaderWrap}>
          {logoUploading && (
            <View style={styles.logoUploadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary.main} />
              <Text style={styles.logoUploadingText}>Se încarcă...</Text>
            </View>
          )}
          <ImageUploader
            key={displayLogoUrl ?? 'no-logo'}
            value={displayLogoUrl}
            onChange={handleLogoChange}
            placeholder="Încarcă logo"
            aspectRatio={[1, 1]}
            maxWidth={160}
            maxHeight={160}
            centerAlign
            disabled={logoUploading}
          />
        </View>
      </View>

      {/* Adauga imagini de prezentare - framed section */}
      <View style={styles.photosSection}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Adaugă imagini de prezentare
        </Text>
        <Text variant="bodySmall" style={styles.sectionSubtitle}>
          Fotografii cu clinica, echipa și facilitățile (până la 10 imagini).
        </Text>
        {Platform.OS === 'web' ? (
          <WebPhotoUploader
            companyId={company.id}
            existingPhotos={company.photos || []}
            maxPhotos={10}
            onUploadSuccess={handleWebUploadSuccess}
            onDeleteSuccess={handleWebDeleteSuccess}
          />
        ) : (
          <MultipleImageUploader
            companyId={company.id}
            existingPhotos={company.photos || []}
            maxPhotos={10}
            onPhotosChange={handlePhotosChange}
          />
        )}
      </View>

      <View style={styles.tips}>
        <Text variant="titleMedium" style={styles.tipsTitle}>
          Sfaturi pentru fotografii
        </Text>
        <Text variant="bodyMedium" style={styles.tipText}>
          • Folosește fotografii de calitate, bine luminate
        </Text>
        <Text variant="bodyMedium" style={styles.tipText}>
          • Arată exteriorul și interiorul clinicii
        </Text>
        <Text variant="bodyMedium" style={styles.tipText}>
          • Include fotografii cu echipa și echipamentul
        </Text>
        <Text variant="bodyMedium" style={styles.tipText}>
          • Evită imaginile neclare sau întunecoase
        </Text>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: theme.colors.surface.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface.background,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.neutral[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: theme.colors.error.main,
    textAlign: 'center',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
    color: theme.colors.neutral[900],
  },
  subtitle: {
    color: theme.colors.neutral[600],
    lineHeight: 20,
  },
  logoSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: theme.colors.surface.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 4,
    color: theme.colors.neutral[900],
  },
  sectionSubtitle: {
    color: theme.colors.neutral[600],
    marginBottom: 16,
  },
  logoUploaderWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  logoUploadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoUploadingText: {
    marginTop: 8,
    color: theme.colors.neutral[700],
    fontWeight: '500',
  },
  photosSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: theme.colors.surface.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
  },
  tips: {
    marginTop: 32,
    padding: 16,
    backgroundColor: theme.colors.primary[50],
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.main,
  },
  tipsTitle: {
    fontWeight: '700',
    marginBottom: 12,
    color: theme.colors.neutral[900],
  },
  tipText: {
    color: theme.colors.neutral[700],
    marginBottom: 4,
  },
});
