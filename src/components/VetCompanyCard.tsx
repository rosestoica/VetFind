/**
 * VetCompanyCard - Premium card component for displaying vet company info
 *
 * Features:
 * - Photo placeholder with gradient background
 * - Rating badge (top-right)
 * - Clinic type badge (bottom-left of photo)
 * - Distance badge (bottom-right of photo, conditional)
 * - Company info section (name, address, phone)
 * - Open/Closed status bar
 * - Press animation and navigation
 */

import React, { memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { memo as performanceMemo } from '../utils/performance';
import { Text, Card } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Company, ClinicTypeLabels, OpeningHours, DaySchedule, CompanyService } from '../types/company.types';
import { RouteDistance } from '../types/routes.types';
import { useTheme } from '../hooks/useTheme';
import { formatPriceRange } from '../utils/currency';
import { translateSpecializationName } from '../constants/serviceTranslations';

interface VetCompanyCardProps {
  company: Company;
  distance?: number; // Haversine distance in km (fallback)
  routeDistance?: RouteDistance; // Google Routes driving distance (preferred)
  matchedService?: CompanyService; // Optional service matched by a search, used to display price
  /** When set, show red "Disponibil in regim de urgenta" badge and expandable details (fee, contact) */
  emergencyOnly?: { emergency_fee?: number | null; emergency_contact_phone?: string | null };
  onPress: () => void;
}

/**
 * Get today's day name
 */
const getTodayName = (): keyof OpeningHours => {
  const days: (keyof OpeningHours)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return days[new Date().getDay()];
};

/**
 * Get today's schedule from opening hours
 */
const getTodaySchedule = (openingHours?: OpeningHours): DaySchedule | null => {
  if (!openingHours) return null;

  const today = getTodayName();
  return openingHours[today] || null;
};

/**
 * Format opening hours for display
 */
const formatOpeningHours = (schedule: DaySchedule | null): { text: string; isOpen: boolean } => {
  if (!schedule || schedule.closed || !schedule.open || !schedule.close) {
    return { text: 'Închis astăzi', isOpen: false };
  }

  // Check if currently open
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [openHour, openMin] = schedule.open.split(':').map(Number);
  const [closeHour, closeMin] = schedule.close.split(':').map(Number);

  const openTime = openHour * 60 + openMin;
  const closeTime = closeHour * 60 + closeMin;

  const isOpen = currentTime >= openTime && currentTime < closeTime;

  return {
    text: `${isOpen ? 'Deschis' : 'Închis'} · ${schedule.open} - ${schedule.close}`,
    isOpen,
  };
};

/**
 * Format distance for display
 */
const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

/**
 * Get clinic type icon
 */
const getClinicTypeIcon = (clinicType: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  const iconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    general_practice: 'hospital-building',
    emergency_care: 'ambulance',
    specialized_care: 'stethoscope',
    mobile_vet: 'car',
    emergency_24_7: 'clock-alert',
  };

  return iconMap[clinicType] || 'hospital-building';
};

/**
 * VetCompanyCard Component - Memoized for performance
 * Only re-renders when props actually change
 */
const VetCompanyCardComponent = ({ company, distance, routeDistance, matchedService, emergencyOnly, onPress }: VetCompanyCardProps) => {
  const { colors, borderRadius, responsive } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const [emergencyDetailsExpanded, setEmergencyDetailsExpanded] = React.useState(false);

  const todaySchedule = getTodaySchedule(company.opening_hours);
  const { text: hoursText, isOpen } = formatOpeningHours(todaySchedule);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      // useNativeDriver is not available in web's native animated module; use JS driver
      useNativeDriver: false,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      // useNativeDriver is not available in web's native animated module; use JS driver
      useNativeDriver: false,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  // Use persisted rating from backend; fall back to legacy avg_rating; default to 0
  const persistedRating = (company as any).rating as unknown;
  const rating = typeof persistedRating === 'number'
    ? persistedRating
    : (typeof company.avg_rating === 'number' ? company.avg_rating : 0);
  const reviewCount = typeof company.review_count === 'number' ? company.review_count : 0;

  const resolveCompanyPhotoUrl = (photoUrl: string) => {
    if (!photoUrl) return photoUrl;
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;

    // If EXPO_PUBLIC_API_URL includes /api, strip it for static assets (/uploads)
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
    const origin = apiBase.replace(/\/api\/?$/i, '');
    const normalized = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
    return `${origin}${normalized}`;
  };

  // Prefer logo as card background; fallback to first gallery photo
  const heroPhoto = company.logo_url || (company.photos && company.photos.length > 0 ? company.photos[0] : null);

  return (
    <Animated.View style={[styles.container, {
      transform: [{ scale: scaleAnim }],
      marginHorizontal: responsive.padding,
      marginBottom: responsive.getValue(12, 16, 20),
    }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Card style={[styles.card, {
          backgroundColor: colors.surface.cream,
          borderRadius: borderRadius.lg,
        }]}>
          {/* Photo Section */}
          <View style={[styles.photoContainer, { height: responsive.getValue(120, 140, 160) }]}>
            {heroPhoto ? (
              <>
                <Image
                  source={{ uri: resolveCompanyPhotoUrl(heroPhoto) }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                {/* subtle overlay so badges/text remain readable */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.55)']}
                  style={styles.photoOverlay}
                  pointerEvents="none"
                />
              </>
            ) : (
              <LinearGradient
                colors={[colors.primary.lightest, colors.primary.light]}
                style={styles.photoPlaceholder}
              >
                <MaterialCommunityIcons name="hospital-building" size={48} color={colors.primary.main} />
              </LinearGradient>
            )}

            {/* Large Distance Badge - Top Left (when location is active) */}
            {(routeDistance || distance !== undefined) && (
              <View style={styles.largeDistanceBadge}>
                <Text style={styles.largeDistanceNumber}>
                  {routeDistance ? routeDistance.distanceKm.toFixed(1) : formatDistance(distance!).replace(' km', '').replace(' m', '')}
                </Text>
                <Text style={styles.largeDistanceUnit}>
                  {routeDistance || (distance !== undefined && distance >= 1) ? 'km' : 'm'}
                </Text>
              </View>
            )}

            {/* Rating Badge - Top Right */}
            <View style={styles.ratingBadge}>
              <MaterialCommunityIcons name="star" size={14} color="#fbbf24" />
              <Text style={styles.ratingText}>
                {rating.toFixed(1)}
                <Text style={styles.ratingCountText}> ({reviewCount})</Text>
              </Text>
            </View>

            {/* Bottom Badges Container */}
            <View style={styles.bottomBadgesContainer}>
              {/* Clinic Type Badge - Bottom Left */}
              <View style={styles.clinicTypeBadge}>
                <MaterialCommunityIcons
                  name={getClinicTypeIcon(company.clinic_type)}
                  size={14}
                  color={colors.primary.main}
                />
                <Text style={[styles.clinicTypeBadgeText, { color: colors.primary.main }]}>
                  {ClinicTypeLabels[company.clinic_type]}
                </Text>
              </View>

              {/* Distance Badge - Bottom Right (conditional) */}
              {/* Prefer route distance (driving) over Haversine (straight-line) */}
              {routeDistance ? (
                <View style={styles.distanceBadge}>
                  <Ionicons name="car" size={12} color="#ffffff" />
                  <Text style={styles.distanceBadgeText}>
                    {routeDistance.distanceKm.toFixed(1)} km · {routeDistance.durationText}
                  </Text>
                </View>
              ) : distance !== undefined && (
                <View style={styles.distanceBadge}>
                  <Ionicons name="location" size={12} color="#ffffff" />
                  <Text style={styles.distanceBadgeText}>{formatDistance(distance)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Săgeată laterală sub logo pentru profil complet */}
          <View style={styles.chevronRow}>
            <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
          </View>

          {/* Company Info Section */}
          <Card.Content style={styles.cardContent}>
              {/* Header row: company name */}
              <View style={styles.headerRow}>
                <Text variant="titleMedium" style={styles.companyName} numberOfLines={1}>
                  {company.name}
                </Text>
              </View>

            {/* Matched service price (when user searched for a service) */}
            {matchedService && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{translateSpecializationName(matchedService.service_name) || matchedService.service_name}</Text>
                <View style={styles.priceBadgeSmall}>
                  <Text style={styles.priceBadgeTextLarge}>
                    {formatPriceRange(matchedService.price_min, matchedService.price_max)}
                  </Text>
                </View>
              </View>
            )}

            {/* Address */}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#6b7280" />
              <Text variant="bodyMedium" style={styles.infoText} numberOfLines={1}>
                {company.address}, {company.city}
              </Text>
            </View>

            {/* Distance (when location is active) */}
            {(routeDistance || distance !== undefined) && (
              <View style={styles.infoRow}>
                <Ionicons name="navigate" size={16} color="#3b82f6" />
                <Text variant="bodyMedium" style={[styles.infoText, { color: '#3b82f6', fontWeight: '600' }]}>
                  {routeDistance
                    ? `${routeDistance.distanceKm.toFixed(1)} km · ${routeDistance.durationText} cu mașina`
                    : `${formatDistance(distance!)} depărtare`
                  }
                </Text>
              </View>
            )}

            {/* Phone */}
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={16} color="#6b7280" />
              <Text variant="bodyMedium" style={styles.infoText}>
                {company.phone}
              </Text>
            </View>

            {/* Când e regim de urgență: bandă mare roșie "Disponibil în regim de urgență - Vezi detalii" în loc de Închis */}
            {emergencyOnly ? (
              <>
                <TouchableOpacity
                  style={styles.emergencyStatusBar}
                  onPress={() => setEmergencyDetailsExpanded((v) => !v)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="alert-circle" size={22} color="#dc2626" />
                  <Text style={styles.emergencyStatusBarTitle}>Disponibil în regim de urgență</Text>
                  <Text style={styles.emergencyStatusBarSub}>Vezi detalii</Text>
                  <Ionicons name={emergencyDetailsExpanded ? 'chevron-up' : 'chevron-down'} size={22} color="#dc2626" />
                </TouchableOpacity>
                {emergencyDetailsExpanded && (
                  <View style={styles.emergencyDetails}>
                    {emergencyOnly.emergency_fee != null && Number(emergencyOnly.emergency_fee) >= 0 && (
                      <Text style={styles.emergencyDetailText}>
                        Taxă urgență: {formatPriceRange(emergencyOnly.emergency_fee, null)}
                      </Text>
                    )}
                    {(emergencyOnly.emergency_contact_phone || company.phone) && (
                      <Text style={styles.emergencyDetailText}>
                        Contact de urgență: {emergencyOnly.emergency_contact_phone || company.phone}
                      </Text>
                    )}
                  </View>
                )}
              </>
            ) : (
              /* Opening Hours Status (când nu e regim urgență) */
              <View style={[styles.statusBar, isOpen ? styles.statusOpen : styles.statusClosed]}>
                <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
                <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                  {hoursText}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Memoized VetCompanyCard with custom comparison
 * Only re-renders if company.id, distance, or matchedService changes
 */
export const VetCompanyCard = memo(
  VetCompanyCardComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.company.id === nextProps.company.id &&
      prevProps.company.logo_url === nextProps.company.logo_url &&
      prevProps.company.photos?.[0] === nextProps.company.photos?.[0] &&
      prevProps.distance === nextProps.distance &&
      prevProps.routeDistance?.distanceMeters === nextProps.routeDistance?.distanceMeters &&
      prevProps.matchedService?.id === nextProps.matchedService?.id &&
      !!prevProps.emergencyOnly === !!nextProps.emergencyOnly
    );
  }
);

const styles = StyleSheet.create({
  container: {
    // marginHorizontal and marginBottom set inline with responsive values
  },
  card: {
    // backgroundColor and borderRadius set inline with theme values
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  photoContainer: {
    position: 'relative',
    // height set inline with responsive values
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  photoPlaceholderText: {
    // color set inline with theme
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  largeDistanceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 70,
  },
  largeDistanceNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  largeDistanceUnit: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: -2,
    opacity: 0.95,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  ratingCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.95,
  },
  bottomBadgesContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clinicTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  clinicTypeBadgeText: {
    // color set inline with colors.primary.main
    fontSize: 12,
    fontWeight: '600',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  distanceBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  /* header & sort button styles */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  companyName: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1f2937',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  priceLabel: {
    color: '#6b7280',
    fontSize: 13,
    flex: 1,
  },
  priceBadgeSmall: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  priceBadgeText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 13,
  },
  priceBadgeTextLarge: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    color: '#6b7280',
    flex: 1,
  },
  emergencyStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 2,
    borderColor: '#dc2626',
    gap: 10,
  },
  emergencyStatusBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#dc2626',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emergencyStatusBarSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b91c1c',
    fontStyle: 'italic',
  },
  emergencyDetails: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 8,
    gap: 6,
  },
  emergencyDetailText: {
    fontSize: 14,
    color: '#374151',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  statusOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusClosed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusTextOpen: {
    color: '#059669',
  },
  statusTextClosed: {
    color: '#dc2626',
  },
  chevronRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
});

export default VetCompanyCard;
