import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Image, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip, Menu } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Company, CategoryWithSpecializations, CompanyService } from '../types/company.types';
import { ApiService } from '../services/api';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation.types';
import { useAuth } from '../context/AuthContext';
import { CategoryCard } from '../components/Dashboard/CategoryCard';
import { QuickActions } from '../components/Dashboard/QuickActions';
import { StatCard } from '../components/Dashboard/StatCard';
import { theme } from '../theme';
import { getCategoryLabelRO } from '../constants/serviceTranslations';

/**
 * CompanyDashboardScreen - Main dashboard for vet company users
 *
 * Features:
 * - Company info card (logo, name, address)
 * - Profile completion indicator
 * - Quick stats cards (placeholders for future features)
 * - Quick action buttons (manage services, update prices, add photos, edit profile)
 * - Loading states
 */
export const CompanyDashboardScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'CompanyDashboard'>>();
  const { logout } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [categories, setCategories] = useState<CategoryWithSpecializations[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadCompany();
  }, []);

  useEffect(() => {
    if (company) {
      loadCategories();
    }
  }, [company]);

  useEffect(() => {
    const loadServices = async () => {
      if (!company) return;
      try {
        setIsLoadingServices(true);

        // Prefer services embedded in company payload (returned by backend) to avoid stale or cross-company data
        const svcFromCompany = (company as any).services as any[] | undefined;
        if (Array.isArray(svcFromCompany)) {
          const filtered = svcFromCompany.filter(s => s && (s.company_id === company.id || s.companyId === company.id) && (s.is_active === undefined || s.is_active === true));
          setServices(filtered);
        } else {
          const svc = await ApiService.getServices(company.id);
          setServices(svc || []);
        }
      } catch (err) {
        console.error('Error loading services:', err);
      } finally {
        setIsLoadingServices(false);
      }
    };

    loadServices();
  }, [company]);

  const loadCompany = async () => {
    try {
      setIsLoading(true);
      const fetchedCompany = await ApiService.getMyCompany();

      if (fetchedCompany) {
        setCompany(fetchedCompany);
        calculateProfileCompletion(fetchedCompany);
      }
    } catch (error) {
      console.error('Error loading company:', error);
      Alert.alert('Eroare', 'Nu s-a putut încărca profilul companiei.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const calculateProfileCompletion = (company: Company) => {
    let completedFields = 0;
    const totalFields = 15;

    // Required fields (always filled)
    completedFields += 7; // name, email, phone, address, city, state, zip_code

    // Optional fields
    if (company.logo_url) completedFields++;
    if (company.website) completedFields++;
    if (company.description && company.description.length >= 50) completedFields++;
    if (company.photos && company.photos.length >= 4) completedFields++;
    if (company.specializations && company.specializations.length > 0) completedFields++;
    if (company.facilities && company.facilities.length > 0) completedFields++;
    if (company.payment_methods && company.payment_methods.length > 0) completedFields++;
    if (company.num_veterinarians) completedFields++;

    const percentage = Math.round((completedFields / totalFields) * 100);
    setProfileCompletion(percentage);
  };

  const loadCategories = async () => {
    try {
      setIsLoadingCategories(true);
      const allCategories = await ApiService.getServiceCategoriesWithSpecializations();

      // Filter categories that have at least one specialization selected by the company
      // For now, we'll show all categories since the company profile uses the old specializations array
      // In the future, this should be filtered based on company.selected_specializations
      setCategories(allCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Don't show alert for categories loading failure - it's not critical
    } finally {
      setIsLoadingCategories(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Se încarcă profilul companiei...
        </Text>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text variant="headlineSmall" style={styles.errorText}>
          Profilul companiei nu a fost găsit
        </Text>
        <Button
          mode="contained"
          onPress={loadCompany}
          buttonColor={theme.colors.primary.main}
          style={styles.retryButton}
        >
          Reîncearcă
        </Button>
      </View>
    );
  }

  const avgRatingValue = typeof company.avg_rating === 'number' ? company.avg_rating : Number((company as any).avg_rating);
  const reviewCountValue = typeof company.review_count === 'number' ? company.review_count : Number((company as any).review_count);
  const hasReviews = (Number.isFinite(reviewCountValue) ? reviewCountValue : 0) > 0;
  const averageRatingDisplay = hasReviews && Number.isFinite(avgRatingValue)
    ? avgRatingValue.toFixed(1)
    : '--';

  const weeklyAppointmentsValue = typeof (company as any).weekly_appointments === 'number'
    ? (company as any).weekly_appointments
    : Number((company as any).weekly_appointments);
  const weeklyAppointmentsDisplay = Number.isFinite(weeklyAppointmentsValue)
    ? String(weeklyAppointmentsValue)
    : '--';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Compact Header */}
      <LinearGradient
        colors={[...theme.gradients.bannerDuo]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {company.logo_url ? (
              <Image source={{ uri: company.logo_url }} style={styles.headerLogo} />
            ) : (
              <View style={styles.headerLogoPlaceholder}>
                <Ionicons name="business" size={24} color="#FFFFFF" />
              </View>
            )}
            <View>
              <Text variant="titleMedium" style={styles.headerTitle}>
                {company.name}
              </Text>
              {company.is_verified && (
                <View style={styles.verifiedBadgeHeader}>
                  <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                  <Text variant="bodySmall" style={styles.verifiedTextHeader}>
                    Verified
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <TouchableOpacity
                onPress={openMenu}
                style={styles.logoutButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Menu"
              >
                <Ionicons name="menu" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            }
          >
            <Menu.Item
              title="Setări"
              onPress={() => {
                closeMenu();
                navigation.navigate('CompanySettings');
              }}
              leadingIcon="cog-outline"
            />
            <Menu.Item
              title="Deconectare"
              onPress={async () => {
                closeMenu();
                await handleLogout();
              }}
              leadingIcon="logout"
            />
          </Menu>
        </View>
      </LinearGradient>

      {/* 2. Quick Actions (MIDDLE) */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Acțiuni rapide</Text>
        <QuickActions
          onNewAppointment={() => navigation.navigate('CompanyManageAppointments')}
          onManageServices={() => navigation.navigate('ManageServices')}
          onUpdatePrices={() => navigation.navigate('ManagePrices')}
          onAddPhotos={() => navigation.navigate('ManagePhotos')}
        />
      </View>

      {/* 3. Stats (BOTTOM - Secondary) */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          <StatCard
            icon="trending-up"
            iconColor={theme.colors.success.main}
            value={Number.isFinite(reviewCountValue) ? String(reviewCountValue) : '--'}
            label="Recenzii"
            isLoading={false}
          />
          <StatCard
            icon="star"
            iconColor="#fbbf24"
            value={averageRatingDisplay}
            label="Stele"
            isLoading={false}
          />
        </View>

        <Button
          mode="outlined"
          icon="star-outline"
          onPress={() => navigation.navigate('CompanyReviews', { companyId: company.id, companyName: company.name })}
          style={styles.seeReviewsButton}
          textColor={theme.colors.primary.main}
        >
          Vezi recenzii
        </Button>
      </View>

      {/* Services & Categories */}
      {categories.length > 0 && (
        <View style={styles.categoriesContainer}>
          <View style={styles.categoriesHeader}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Servicii pe care le poți oferi
            </Text>
            <Chip
              style={styles.totalServicesChip}
              textStyle={styles.totalServicesChipText}
              compact
            >
              {categories.reduce((sum, cat) => sum + cat.specializations.length, 0)} Total servicii
            </Chip>
          </View>

          {isLoadingCategories ? (
            <View style={styles.categoriesLoading}>
              <ActivityIndicator size="small" color={theme.colors.primary.main} />
              <Text variant="bodyMedium" style={styles.categoriesLoadingText}>
                Se încarcă serviciile...
              </Text>
            </View>
          ) : (
            <View style={styles.categoriesList}>
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Specializations (Legacy) */}
      {company.specializations && company.specializations.length > 0 && (
        <View style={styles.specializationsContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Specializări
          </Text>
          <View style={styles.chipsContainer}>
            {company.specializations.map((spec, index) => (
              <Chip key={index} mode="outlined" style={styles.chip}>
                {getCategoryLabelRO(spec as any)}
              </Chip>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface.background,
  },
  contentContainer: {
    paddingBottom: theme.spacing['3xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface.background,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    color: theme.colors.neutral[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface.background,
    padding: theme.spacing['2xl'],
  },
  errorText: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
    color: theme.colors.error.main,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing['2xl'],
  },
  header: {
    padding: 16,
    paddingTop: 32,
    paddingBottom: 20
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  headerLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18
  },
  verifiedBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  verifiedTextHeader: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 12
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  // Phase 4: New layout sections
  quickActionsSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing['2xl'],
    gap: theme.spacing.lg,
  },
  statsSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing['2xl'],
    gap: theme.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  seeReviewsButton: {
    marginTop: theme.spacing.lg,
    borderColor: theme.colors.primary.main,
    alignSelf: 'flex-start',
  },
  quickActionsContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    borderColor: theme.colors.primary.main,
  },
  actionButtonLabel: {
    color: theme.colors.primary.main,
  },
  specializationsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderColor: theme.colors.primary.main,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    marginBottom: 24
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  totalServicesChip: {
    backgroundColor: theme.colors.primary[100],
    borderColor: theme.colors.primary[300],
  },
  totalServicesChipText: {
    color: theme.colors.primary[700],
    fontWeight: '600',
    fontSize: 12,
  },
  categoriesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12
  },
  categoriesLoadingText: {
    color: '#6b7280'
  },
  categoriesList: {
    gap: 12
  }
  ,
  /* Services preview styles */
  servicesPreviewCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  servicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  servicesTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  noServicesText: {
    color: '#6b7280',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  serviceName: {
    color: '#374151',
  },
  servicePrice: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
});
