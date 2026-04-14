/**
 * VetCompanyDetailScreen - Detailed view of a vet company
 *
 * Features:
 * - Large photo/banner placeholder
 * - Company header (name, rating, contact info)
 * - Description section
 * - Services grouped by category with expandable sections
 * - Each service shows name, price range, and duration
 * - Back navigation
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Linking,
  Platform,
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, ActivityIndicator, Card, Divider, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServiceSelectionSheet from '../components/ServiceSelectionSheet';

import { ApiService } from '../services/api';
import { blurActiveElementIfWeb, disableBlockingAriaHiddenOverlays } from '../utils/dom';
import {
  Company,
  CompanyService,
  ClinicTypeLabels,
  ServiceCategoryType,
  DaySchedule,
  OpeningHours,
  PaymentMethodLabels,
} from '../types/company.types';
import { RootStackParamList } from '../types/navigation.types';
import { formatPriceRange } from '../utils/currency';
import { getCategoryLabelRO, translateSpecializationName } from '../constants/serviceTranslations';

type NavigationProp = StackNavigationProp<RootStackParamList, 'VetCompanyDetail'>;
type RouteProps = RouteProp<RootStackParamList, 'VetCompanyDetail'>;

/**
 * Group services by category
 */
const groupServicesByCategory = (
  services: CompanyService[]
): Record<string, CompanyService[]> => {
  return services.reduce((acc, service) => {
    const category = service.category || 'custom';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, CompanyService[]>);
};

/**
 * Get category icon
 */
  const getCategoryIcon = (category: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  const iconMap: Record<string, any> = {
    routine_care: 'stethoscope',
    dental_care: 'tooth',
    diagnostic_services: 'microscope',
    emergency_care: 'ambulance',
    surgical_procedures: 'scalpel',
    grooming: 'content-cut',
    custom: 'star',
  };
  return (iconMap[category] || 'paw') as any;
};

// formatPrice removed - using formatPriceRange from currency utility

/**
 * Format duration
 */
const formatDuration = (minutes?: number): string => {
  if (!minutes) return '';
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Get today's schedule
 */
const getTodaySchedule = (openingHours?: OpeningHours): DaySchedule | null => {
  if (!openingHours) return null;
  const days: (keyof OpeningHours)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ];
  const today = days[new Date().getDay()];
  return openingHours[today] || null;
};

/**
 * Format opening hours
 */
const formatOpeningHours = (schedule: DaySchedule | null): { text: string; isOpen: boolean } => {
  if (!schedule || schedule.closed || !schedule.open || !schedule.close) {
    return { text: 'Închis azi', isOpen: false };
  }
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMin] = schedule.open.split(':').map(Number);
  const [closeHour, closeMin] = schedule.close.split(':').map(Number);
  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;
  const isOpen = currentTime >= openTime && currentTime < closeTime;
  return {
    text: `${schedule.open} - ${schedule.close}`,
    isOpen,
  };
};

/**
 * ServiceCategorySection Component
 */
interface ServiceCategorySectionProps {
  category: string;
  services: CompanyService[];
  isExpanded: boolean;
  onToggle: () => void;
}

const ServiceCategorySection = ({
  category,
  services,
  isExpanded,
  onToggle,
}: ServiceCategorySectionProps) => {
  const rotateAnim = React.useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      // useNativeDriver cannot be used on web without the native animation module
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <Card style={styles.categoryCard}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryIconContainer}>
            <MaterialCommunityIcons
              name={getCategoryIcon(category)}
              size={24}
              color="#7c3aed"
            />
          </View>
          <View style={styles.categoryTitleContainer}>
            <Text style={styles.categoryTitle}>
              {getCategoryLabelRO(category as ServiceCategoryType) || 'Alte servicii'}
            </Text>
            <Text style={styles.categoryCount}>
              {services.length} service{services.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.servicesContainer}>
          <Divider style={styles.categoryDivider} />
          {services.map((service, index) => (
            <View key={service.id}>
              <View style={styles.serviceItem}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{translateSpecializationName(service.service_name) || service.service_name}</Text>
                  {service.description && (
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>
                  )}
                </View>
                <View style={styles.servicePricing}>
                  <Text style={styles.servicePrice}>
                    {formatPriceRange(service.price_min, service.price_max)}
                  </Text>
                  {service.duration_minutes && (
                    <View style={styles.durationBadge}>
                      <Ionicons name="time-outline" size={12} color="#6b7280" />
                      <Text style={styles.durationText}>
                        {formatDuration(service.duration_minutes)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {index < services.length - 1 && <Divider style={styles.serviceDivider} />}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};

export const VetCompanyDetailScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { companySlug } = route.params;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [company, setCompany] = useState<Company | null>(null);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [serviceSheetVisible, setServiceSheetVisible] = useState(false);
  const bookingRef = React.useRef<any>(null);
  const [sheetOffset, setSheetOffset] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const companyData = await ApiService.getCompanyBySlug(companySlug);

        if (!companyData) {
          setError('Compania nu a fost găsită.');
          return;
        }

        setCompany(companyData);

        const cid = companyData.id;
        const rawServices = ((companyData as any).services as any[]) || (await ApiService.getServices(cid));

        const serviceList = (rawServices || []).filter((s: any) => {
          const belongs = s && (s.company_id === cid || s.companyId === cid);
          const active = s && (s.is_active === undefined || s.is_active === true);
          return Boolean(belongs && active);
        });

        if ((rawServices || []).length > 0 && serviceList.length === 0) {
          console.warn('VetCompanyDetail: all services were filtered out for company', cid, rawServices);
        }

        setServices(serviceList || []);

        const grouped = groupServicesByCategory(serviceList || []);
        const firstCategory = Object.keys(grouped)[0];
        if (firstCategory) {
          setExpandedCategories(new Set([firstCategory]));
        }
      } catch (err: any) {
        setError(err.message || 'Nu s-au putut încărca detaliile companiei.');
        console.error('Error fetching company:', err);
      } finally {
        blurActiveElementIfWeb();
        setIsLoading(false);
      }
    };

    fetchData();
  }, [companySlug]);

  // Defensive: disable blocking aria-hidden overlays on mount (web only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const restore = disableBlockingAriaHiddenOverlays();
    return () => {
      try {
        restore();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Ensure page can scroll on web: temporarily force html/body overflow to auto while this screen is mounted
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    try {
      html.style.overflow = 'auto';
      body.style.overflow = 'auto';
    } catch (e) {
      // ignore
    }

    return () => {
      try {
        html.style.overflow = prevHtmlOverflow;
        body.style.overflow = prevBodyOverflow;
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleCall = () => {
    if (company?.phone) {
      Linking.openURL(`tel:${company.phone}`);
    }
  };

  const handleServiceSelect = (service: CompanyService) => {
    setServiceSheetVisible(false);
    navigation.navigate('BookAppointment', {
      companyId: company!.id,
      companyName: company?.name || '',
      selectedServices: [service],
    });
  };

  const groupedServices = groupServicesByCategory(services);
  const todaySchedule = company ? getTodaySchedule(company.opening_hours) : null;
  const { text: hoursText, isOpen } = formatOpeningHours(todaySchedule);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  const companyPhotos = useMemo(() => {
    const raw = (company?.photos || []) as any[];
    return raw.filter((p) => typeof p === 'string' && p.trim().length > 0) as string[];
  }, [company?.photos]);

  const resolveCompanyPhotoUrl = (photoUrl: string) => {
    if (!photoUrl) return photoUrl;
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;

    // If EXPO_PUBLIC_API_URL includes /api, strip it for static assets (/uploads)
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
    const origin = apiBase.replace(/\/api\/?$/i, '');
    const normalized = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
    return `${origin}${normalized}`;
  };

  const onBannerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = Math.max(1, windowWidth);
    const x = e.nativeEvent.contentOffset.x || 0;
    const idx = Math.round(x / w);
    setActivePhotoIndex(Math.max(0, Math.min(idx, companyPhotos.length - 1)));
  };

  const openPhotoViewer = (index: number) => {
    setPhotoViewerIndex(Math.max(0, Math.min(index, companyPhotos.length - 1)));
    setPhotoViewerVisible(true);
  };

  const onViewerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = Math.max(1, windowWidth);
    const x = e.nativeEvent.contentOffset.x || 0;
    const idx = Math.round(x / w);
    setPhotoViewerIndex(Math.max(0, Math.min(idx, companyPhotos.length - 1)));
  };

  /**
   * Render full weekly schedule. Expects company.opening_hours with keys sunday..saturday
   */
  const renderWeekSchedule = (openingHours?: OpeningHours) => {
    if (!openingHours) return null;

    const days: { key: keyof OpeningHours; label: string }[] = [
      { key: 'sunday', label: 'Duminică' },
      { key: 'monday', label: 'Luni' },
      { key: 'tuesday', label: 'Marți' },
      { key: 'wednesday', label: 'Miercuri' },
      { key: 'thursday', label: 'Joi' },
      { key: 'friday', label: 'Vineri' },
      { key: 'saturday', label: 'Sâmbătă' },
    ];

    return (
      <View style={styles.scheduleContainer}>
        {days.map(d => {
          const sched = openingHours[d.key] as DaySchedule | undefined | null;
          const isClosed = !sched || sched.closed || !sched.open || !sched.close;
          const hoursText = isClosed ? 'Închis' : `${sched!.open} - ${sched!.close}`;
          return (
            <View key={d.key} style={styles.dayRow}>
              <Text style={styles.dayName}>{d.label}</Text>
              <View style={styles.dayRight}>
                <View style={[styles.dayOpenDot, isClosed ? styles.dotClosed : styles.dotOpen]} />
                <Text style={[styles.dayHours, isClosed ? styles.closedText : styles.openText]}>{hoursText}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Use persisted rating info from company if available
  const rating = typeof company?.avg_rating === 'number' ? company.avg_rating : 0;
  const reviewCount = typeof company?.review_count === 'number' ? company.review_count : 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Se încarcă detaliile clinicii...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !company) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorText}>{error || 'Compania nu a fost găsită.'}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Înapoi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#7c3aed" />

      {/* Back Button Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Full-screen photo viewer */}
      <Modal
        visible={photoViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <View style={styles.viewerRoot}>
          <Pressable style={styles.viewerBackdrop} onPress={() => setPhotoViewerVisible(false)} />

          <View style={styles.viewerContent}>
            <TouchableOpacity
              style={styles.viewerCloseButton}
              onPress={() => setPhotoViewerVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Închide vizualizatorul foto"
            >
              <Ionicons name="close" size={26} color="#ffffff" />
            </TouchableOpacity>

            {companyPhotos.length > 0 && (
              <Text style={styles.viewerCounter}>
                {photoViewerIndex + 1} / {companyPhotos.length}
              </Text>
            )}

            <FlatList
              data={companyPhotos}
              horizontal
              pagingEnabled
              initialScrollIndex={photoViewerIndex}
              getItemLayout={(_, index) => ({
                length: Math.max(1, windowWidth),
                offset: Math.max(1, windowWidth) * index,
                index,
              })}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onViewerScrollEnd}
              keyExtractor={(item, index) => `viewer-${index}-${item}`}
              renderItem={({ item }) => (
                <View style={{ width: windowWidth, height: windowHeight }}>
                  <Image
                    source={{ uri: resolveCompanyPhotoUrl(item) }}
                    style={styles.viewerImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

  <GestureHandlerRootView style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
        {/* Photo Banner */}
        <View style={styles.bannerContainer}>
          {companyPhotos.length > 0 ? (
            <>
              <FlatList
                data={companyPhotos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `${index}-${item}`}
                onMomentumScrollEnd={onBannerScrollEnd}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => openPhotoViewer(index)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Deschide fotografia clinicii"
                  >
                    <Image
                      source={{ uri: resolveCompanyPhotoUrl(item) }}
                      style={[styles.bannerImage, { width: windowWidth || Dimensions.get('window').width }]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
              />

              {/* Dark overlay to keep text readable */}
              <LinearGradient
                colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)']}
                pointerEvents="none"
                style={styles.bannerOverlay}
              />

              {/* Dots indicator */}
              {companyPhotos.length > 1 && (
                <View pointerEvents="none" style={styles.bannerDots}>
                  {companyPhotos.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.bannerDot, i === activePhotoIndex ? styles.bannerDotActive : null]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <LinearGradient
              colors={['#7c3aed', '#9333ea']}
              style={styles.bannerGradient}
            >
              <MaterialCommunityIcons name="hospital-building" size={64} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          )}

          {/* Rating Badge */}
          <View style={styles.ratingRow}>
            <View style={styles.ratingBadge}>
              <MaterialCommunityIcons name="star" size={16} color="#fbbf24" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              <Text style={styles.reviewCountText}>({reviewCount})</Text>
            </View>

            <TouchableOpacity
              style={styles.seeReviewsButton}
              onPress={() => {
                navigation.navigate('CompanyReviews', {
                  companyId: company!.id,
                  companyName: company?.name,
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="See reviews"
            >
              <Text style={styles.seeReviewsText}>Vezi recenziile</Text>
              <Ionicons name="chevron-forward" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Company Info Section */}
        <View style={styles.infoSection}>
          {/* Company Name */}
          <Text style={styles.companyName}>{company.name}</Text>

          {/* Clinic Type Badge */}
          <View style={styles.clinicTypeBadge}>
            <MaterialCommunityIcons name="hospital-building" size={16} color="#7c3aed" />
            <Text style={styles.clinicTypeText}>
              {ClinicTypeLabels[company.clinic_type]}
            </Text>
          </View>

          {/* Description (moved higher so pet owners see it near the top) */}
          {company.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Descriere clinică</Text>
              <Text style={styles.descriptionText}>{company.description}</Text>
            </View>
          )}

          {/* Contact Info Card */}
          <Card style={styles.contactCard}>
            <Card.Content>
              {/* Address */}
              <TouchableOpacity style={styles.contactRow}>
                <Ionicons name="location" size={20} color="#7c3aed" />
                <Text style={styles.contactText}>
                  {company.address}, {company.city}
                </Text>
              </TouchableOpacity>

              <Divider style={styles.contactDivider} />

              {/* Phone */}
              <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
                <Ionicons name="call" size={20} color="#7c3aed" />
                <Text style={[styles.contactText, styles.phoneText]}>{company.phone}</Text>
                <Ionicons name="open-outline" size={16} color="#9ca3af" />
              </TouchableOpacity>

              <Divider style={styles.contactDivider} />

              {/* Hours */}
              <View style={styles.contactRow}>
                <Ionicons name="time" size={20} color="#7c3aed" />
                <View style={styles.hoursContainer}>
                  <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
                  <Text style={[styles.hoursStatus, isOpen ? styles.hoursOpen : styles.hoursClosed]}>
                    {isOpen ? 'Deschis' : 'Închis'}
                  </Text>
                  <Text style={styles.hoursText}>{hoursText}</Text>
                </View>
              </View>
              {/* Weekly schedule visible to pet owners */}
              {company && renderWeekSchedule(company.opening_hours)}
            </Card.Content>
          </Card>

          {/* Services Section */}
          <View style={styles.servicesSection}>
            <View style={styles.servicesSectionHeader}>
              <MaterialCommunityIcons name="medical-bag" size={24} color="#7c3aed" />
              <Text style={styles.servicesSectionTitle}>Our Services & Prices</Text>
            </View>

            {services.length === 0 ? (
              <View style={styles.noServicesContainer}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={48} color="#d1d5db" />
                <Text style={styles.noServicesText}>Niciun serviciu listat încă</Text>
              </View>
            ) : (
              Object.entries(groupedServices).map(([category, categoryServices]) => (
                <ServiceCategorySection
                  key={category}
                  category={category}
                  services={categoryServices}
                  isExpanded={expandedCategories.has(category)}
                  onToggle={() => toggleCategory(category)}
                />
              ))
            )}
          </View>

        </View>

        {/* Booking Button (full-width, shown under Services) */}
        {services.length > 0 && (
          <View
            style={styles.bookingContainer}
            ref={bookingRef}
            onLayout={() => {
              // Measure the button position and compute offset from bottom
              try {
                // Delay measurement slightly to ensure layout is settled
                setTimeout(() => {
                  if (bookingRef.current && typeof bookingRef.current.measureInWindow === 'function') {
                    bookingRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
                      const screenHeight = Dimensions.get('window').height;
                      const offset = Math.max(0, screenHeight - (y + h));
                      setSheetOffset(offset);
                    });
                  }
                }, 50);
              } catch (e) {
                // ignore measurement errors
              }
            }}
          >
            <Button
              mode="contained"
              icon="calendar-plus"
              onPress={() => setServiceSheetVisible(true)}
              style={styles.bookingButton}
              labelStyle={styles.bookingButtonLabel}
              uppercase={false}
            >
              Rezervă o programare
            </Button>
          </View>
        )}

        {/* Payment Methods (visible to all pet owners) */}
        <Card style={[styles.contactCard, styles.paymentCard]}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.chipsRow}>
              {company.payment_methods && company.payment_methods.length > 0 ? (
                company.payment_methods.map((p) => (
                  <View key={p} style={styles.chip}>
                    <Text style={styles.chipText}>{PaymentMethodLabels[p]}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.contactText}>Nespecificat</Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
        </ScrollView>
      </GestureHandlerRootView>

      {/* (Removed floating FAB; full-width booking button is shown under services) */}

      {/* Service Selection Bottom Sheet */}
      <ServiceSelectionSheet
        visible={serviceSheetVisible}
        services={services}
        companyName={company?.name || ''}
        onDismiss={() => setServiceSheetVisible(false)}
        multiSelect={true}
        onSelectServices={(selected) => {
          setServiceSheetVisible(false);
          navigation.navigate('BookAppointment', {
            companyId: company!.id,
            companyName: company?.name || '',
            selectedServices: selected,
          });
        }}
        bottomOffset={sheetOffset}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  headerBar: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBackText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    // avoid forcing full-height on web; let contentContainerStyle control scrolling
  },
  bannerContainer: {
    position: 'relative',
    height: 200,
    overflow: 'hidden',
  },
  bannerGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    height: 200,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerDots: {
    position: 'absolute',
    left: 16,
    bottom: 18,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  bannerDotActive: {
    width: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  viewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  viewerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCounter: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  ratingRow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  seeReviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
  },
  seeReviewsText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  reviewCountText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  infoSection: {
    padding: 16,
  },
  companyName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  clinicTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 16,
  },
  clinicTypeText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  contactText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  phoneText: {
    color: '#7c3aed',
    fontWeight: '500',
  },
  contactDivider: {
    backgroundColor: '#f3f4f6',
  },
  hoursContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOpen: {
    backgroundColor: '#10b981',
  },
  dotClosed: {
    backgroundColor: '#ef4444',
  },
  hoursStatus: {
    fontSize: 15,
    fontWeight: '600',
  },
  hoursOpen: {
    color: '#059669',
  },
  hoursClosed: {
    color: '#dc2626',
  },
  hoursText: {
    fontSize: 15,
    color: '#6b7280',
  },
  scheduleContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 16,
    elevation: 1,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dayName: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  dayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayOpenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayHours: {
    fontSize: 14,
    color: '#6b7280',
  },
  closedText: {
    color: '#9ca3af',
  },
  openText: {
    color: '#059669',
  },
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
  },
  servicesSection: {
    marginBottom: 16,
  },
  servicesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  servicesSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  noServicesContainer: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  noServicesText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitleContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  categoryCount: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  categoryDivider: {
    backgroundColor: '#e5e7eb',
  },
  servicesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  serviceItem: {
    flexDirection: 'row',
    paddingVertical: 14,
  },
  serviceInfo: {
    flex: 1,
    paddingRight: 12,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },
  servicePricing: {
    alignItems: 'flex-end',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 4,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: '#6b7280',
  },
  serviceDivider: {
    backgroundColor: '#f3f4f6',
  },
  bottomPadding: {
    height: 100, // Extra padding for FAB
  },
  bookingContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  bookingButton: {
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    elevation: 2,
  },
  bookingButtonLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});

export default VetCompanyDetailScreen;
