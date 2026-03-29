/**
 * AppointmentCard Component
 *
 * Displays appointment information for pet owners in a compact, visually appealing card.
 * Can show both upcoming and past appointments with different styling.
 *
 * Features:
 * - Prominent display for upcoming appointments
 * - Compact display for past appointments
 * - Status indicators (pending, confirmed, completed, cancelled)
 * - Action buttons (view details, cancel, rebook)
 * - Warm professional design with blue/terracotta colors
 *
 * Usage:
 * ```tsx
 * <AppointmentCard
 *   appointment={appointment}
 *   variant="upcoming"
 *   onPress={() => handlePress(appointment.id)}
 * />
 * ```
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { formatPriceRange } from '../../utils/currency';

/**
 * Appointment interface
 */
export interface AppointmentData {
  id: number;
  clinicName: string;
  clinicLogo?: string;
  clinicAddress?: string;
  date: string;  // e.g., "Dec 25, 2024"
  time: string;  // e.g., "10:00 AM"
  petName: string;
  // For backwards compatibility a single service name may be provided
  service?: string;
  // Support multiple services snapshot (backend may return this)
  services?: Array<{
    service_name?: string;
    price_min?: number | null;
    price_max?: number | null;
    duration_minutes?: number | null;
  }>;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  // Legacy single price
  price?: number;
  // Aggregates (optional)
  total_price_min?: number | null;
  total_price_max?: number | null;
  total_duration_minutes?: number | null;
}

/**
 * Props interface
 */
export interface AppointmentCardProps {
  appointment: AppointmentData;
  variant?: 'upcoming' | 'past' | 'compact';
  onPress?: () => void;
  onCancel?: () => void;
  onRebook?: () => void;
}

/**
 * AppointmentCard Component
 */
export const AppointmentCard = ({
  appointment,
  variant = 'upcoming',
  onPress,
  onCancel,
  onRebook,
}: AppointmentCardProps) => {
  const statusConfig = {
    pending: {
      color: theme.colors.warning.main,
      bg: theme.colors.warning[100],
      border: theme.colors.warning[300],
      icon: 'time-outline' as const,
      label: 'În așteptare',
    },
    confirmed: {
      color: theme.colors.primary.main,
      bg: theme.colors.primary[100],
      border: theme.colors.primary[300],
      icon: 'checkmark-circle-outline' as const,
      label: 'Confirmat',
    },
    completed: {
      color: theme.colors.success.main,
      bg: theme.colors.success[100],
      border: theme.colors.success[300],
      icon: 'checkmark-done-outline' as const,
      label: 'Finalizat',
    },
    cancelled: {
      color: theme.colors.neutral[600],
      bg: theme.colors.surface.cream,
      border: theme.colors.surface.border,
      icon: 'close-circle-outline' as const,
      label: 'Anulat',
    },
  };

  const config = statusConfig[appointment.status];

  // Helper to format duration
  const formatDuration = (minutes?: number | null) => {
    const m = Number(minutes || 0) || 0;
    if (m === 0) return '';
    if (m < 60) return `${m} min`;
    const hrs = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${hrs} hr` : `${hrs}h ${rem}m`;
  };

  // Compute totals from services if present, otherwise use aggregates or legacy fields
  let totalMin: number | null = appointment.total_price_min ?? null;
  let totalMax: number | null = appointment.total_price_max ?? null;
  let totalDuration: number | null = appointment.total_duration_minutes ?? null;

  if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    totalMin = appointment.services.reduce((sum, s) => sum + (Number(s.price_min) || 0), 0);
    totalMax = appointment.services.reduce((sum, s) => sum + (Number(s.price_max) || 0), 0);
    totalDuration = appointment.services.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
  } else if (appointment.price != null && (totalMin == null && totalMax == null)) {
    totalMin = totalMax = appointment.price;
  }

  /**
   * Render upcoming appointment (prominent card)
   */
  if (variant === 'upcoming') {
    return (
      <TouchableOpacity
        style={[styles.card, styles.upcomingCard]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: config.bg, borderBottomColor: config.border }]}>
          <Ionicons name={config.icon} size={18} color={config.color} />
          <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
        </View>

        {/* Clinic Info */}
        <View style={styles.clinicSection}>
          {appointment.clinicLogo ? (
            <Image source={{ uri: appointment.clinicLogo }} style={styles.clinicLogo} />
          ) : (
            <View style={styles.clinicLogoPlaceholder}>
              <MaterialCommunityIcons name="hospital-building" size={32} color={theme.colors.primary.main} />
            </View>
          )}

          <View style={styles.clinicInfo}>
            <Text style={styles.clinicName}>{appointment.clinicName}</Text>
            {appointment.clinicAddress && (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.neutral[600]} />
                <Text style={styles.clinicAddress} numberOfLines={1}>{appointment.clinicAddress}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Appointment Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.primary.main} />
            <Text style={styles.detailLabel}>Data:</Text>
            <Text style={styles.detailValue}>{appointment.date}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={20} color={theme.colors.primary.main} />
            <Text style={styles.detailLabel}>Ora:</Text>
            <Text style={styles.detailValue}>{appointment.time}</Text>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="paw" size={20} color={theme.colors.primary.main} />
            <Text style={styles.detailLabel}>Animal:</Text>
            <Text style={styles.detailValue}>{appointment.petName}</Text>
          </View>

          {/* If multiple services were saved, render list and totals */}
          {Array.isArray(appointment.services) && appointment.services.length > 0 ? (
            <View>
              <View style={styles.servicesList}>
                <Text style={styles.servicesLabel}>Servicii:</Text>
                {appointment.services.map((s, idx) => (
                  <Text key={idx} style={styles.serviceRow}>
                    {s.service_name || appointment.service || 'Serviciu'} — {formatPriceRange(s.price_min, s.price_max)}{s.duration_minutes ? ` • ${s.duration_minutes} min` : ''}
                  </Text>
                ))}
              </View>

              {/* Price (total) */}
              {(totalMin != null || totalMax != null) && (
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={20} color={theme.colors.accent.main} />
                  <Text style={styles.detailLabel}>Preț:</Text>
                  <Text style={[styles.detailValue, { color: theme.colors.accent.main, fontWeight: '700' }]}>
                    {formatPriceRange(totalMin, totalMax)}
                  </Text>
                </View>
              )}

              {/* Duration total */}
              {totalDuration != null && (
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={20} color={theme.colors.primary.main} />
                  <Text style={styles.detailLabel}>Durată:</Text>
                  <Text style={styles.detailValue}>{formatDuration(totalDuration)}</Text>
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="medical-bag" size={20} color={theme.colors.primary.main} />
                <Text style={styles.detailLabel}>Serviciu:</Text>
                <Text style={styles.detailValue}>{appointment.service}</Text>
              </View>

              {(totalMin != null || totalMax != null) && (
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={20} color={theme.colors.accent.main} />
                  <Text style={styles.detailLabel}>Preț:</Text>
                  <Text style={[styles.detailValue, { color: theme.colors.accent.main, fontWeight: '700' }]}> {formatPriceRange(totalMin, totalMax)}</Text>
                </View>
              )}

              {totalDuration != null && (
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={20} color={theme.colors.primary.main} />
                  <Text style={styles.detailLabel}>Durată:</Text>
                  <Text style={styles.detailValue}>{formatDuration(totalDuration)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Actions */}
        {(appointment.status === 'confirmed' || appointment.status === 'pending') && onCancel && (
          <Button
            mode="outlined"
            onPress={onCancel}
            style={styles.cancelButton}
            textColor={theme.colors.error.main}
            icon={() => <Ionicons name="close-circle-outline" size={18} color={theme.colors.error.main} />}
          >
            Anulează programarea
          </Button>
        )}
      </TouchableOpacity>
    );
  }

  /**
   * Render past or compact appointment (smaller card)
   */
  return (
    <TouchableOpacity
      style={[styles.card, styles.compactCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.compactHeader}>
        <View style={[styles.compactStatusDot, { backgroundColor: config.color }]} />
        <Text style={styles.compactDate}>{appointment.date}</Text>
        <Text style={styles.compactTime}>{appointment.time}</Text>
      </View>

      <View style={styles.compactBody}>
        <View style={styles.compactMain}>
          <Text style={styles.compactClinicName} numberOfLines={1}>{appointment.clinicName}</Text>
          <Text style={styles.compactService} numberOfLines={1}>
            {appointment.service} • {appointment.petName}{(totalMin != null || totalMax != null) ? ` • ${formatPriceRange(totalMin, totalMax)}` : ''}
          </Text>
        </View>

        {variant === 'past' && appointment.status === 'completed' && onRebook && (
          <Button
            mode="outlined"
            compact
            onPress={onRebook}
            style={styles.rebookButton}
            textColor={theme.colors.primary.main}
            icon={() => <Ionicons name="refresh-outline" size={16} color={theme.colors.primary.main} />}
          >
            Reprogramează
          </Button>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface.cream,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
    overflow: 'hidden',
  },
  upcomingCard: {
    ...theme.shadows.md,
  },
  compactCard: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  statusLabel: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
  },
  clinicSection: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.border,
  },
  clinicLogo: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface.cream,
  },
  clinicLogoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary[300],
  },
  clinicInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  clinicName: {
    ...theme.typography.h4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  clinicAddress: {
    ...theme.typography.bodySmall,
    color: theme.colors.neutral[600],
    flex: 1,
  },
  detailsSection: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  servicesList: {
    marginBottom: theme.spacing.sm,
  },
  servicesLabel: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  serviceRow: {
    ...theme.typography.bodySmall,
    color: theme.colors.neutral[800],
    marginBottom: theme.spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  detailLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.neutral[600],
    width: 60,
  },
  detailValue: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.neutral[900],
    flex: 1,
  },
  cancelButton: {
    margin: theme.spacing.lg,
    marginTop: 0,
    borderColor: theme.colors.error.main,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  compactStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactDate: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.neutral[700],
  },
  compactTime: {
    ...theme.typography.bodySmall,
    color: theme.colors.neutral[500],
  },
  compactBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  compactMain: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  compactClinicName: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.neutral[900],
  },
  compactService: {
    ...theme.typography.bodySmall,
    color: theme.colors.neutral[600],
  },
  rebookButton: {
    borderColor: theme.colors.primary.main,
  },
});
