/**
 * ActivityTimeline Component
 *
 * Displays a timeline of today's appointments and recent activity for vet companies.
 * Uses horizontal scroll for appointments and a vertical feed for recent activities.
 *
 * Features:
 * - Horizontal scrollable appointment cards for today
 * - Recent activity feed (bookings, reviews, profile updates)
 * - Empty state when no appointments
 * - Warm professional design with blue/terracotta accent colors
 *
 * Usage:
 * ```tsx
 * <ActivityTimeline appointments={appointments} activities={activities} />
 * ```
 */

import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme';

/**
 * Appointment interface
 */
export interface Appointment {
  id: number;
  time: string;  // e.g., "09:00 AM"
  petName: string;
  ownerName: string;
  service: string;
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

/**
 * Activity interface for the feed
 */
export interface Activity {
  id: number;
  type: 'booking' | 'review' | 'profile_update' | 'service_update';
  title: string;
  subtitle: string;
  timestamp: string;  // e.g., "2 hours ago"
  icon: string;  // Ionicons name
}

/**
 * Props interface
 */
export interface ActivityTimelineProps {
  appointments: Appointment[];
  activities?: Activity[];
  onAppointmentPress?: (appointmentId: number) => void;
  onActivityPress?: (activityId: number) => void;
  onViewAllAppointments?: () => void;
}

/**
 * ActivityTimeline Component
 */
export const ActivityTimeline = ({
  appointments,
  activities = [],
  onAppointmentPress,
  onActivityPress,
  onViewAllAppointments,
}: ActivityTimelineProps) => {
  /**
   * Render individual appointment card
   */
  const renderAppointmentCard = (appointment: Appointment) => {
    const statusColors = {
      pending: { bg: theme.colors.warning[100], text: theme.colors.warning[700], border: theme.colors.warning[300] },
      confirmed: { bg: theme.colors.primary[100], text: theme.colors.primary[700], border: theme.colors.primary[300] },
      completed: { bg: theme.colors.success[100], text: theme.colors.success[700], border: theme.colors.success[300] },
      cancelled: { bg: theme.colors.surface.cream, text: theme.colors.neutral[600], border: theme.colors.surface.border },
    };

    const statusColor = statusColors[appointment.status || 'pending'];

    return (
      <TouchableOpacity
        key={appointment.id}
        style={styles.appointmentCard}
        onPress={() => onAppointmentPress?.(appointment.id)}
        activeOpacity={0.7}
      >
        {/* Time Badge */}
        <View style={[styles.timeBadge, { backgroundColor: theme.colors.primary.main }]}>
          <Ionicons name="time-outline" size={14} color={theme.colors.white} />
          <Text style={styles.timeText}>{appointment.time}</Text>
        </View>

        {/* Appointment Details */}
        <View style={styles.appointmentDetails}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="paw" size={16} color={theme.colors.primary.main} />
            <Text style={styles.petName}>{appointment.petName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={14} color={theme.colors.neutral[600]} />
            <Text style={styles.ownerName}>{appointment.ownerName}</Text>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="medical-bag" size={14} color={theme.colors.neutral[600]} />
            <Text style={styles.serviceName}>{appointment.service}</Text>
          </View>
        </View>

        {/* Status Badge */}
        {appointment.status && (
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /**
   * Render activity feed item
   */
  const renderActivityItem = (activity: Activity) => {
    const iconColors = {
      booking: theme.colors.primary.main,
      review: theme.colors.accent.main,
      profile_update: theme.colors.info.main,
      service_update: theme.colors.success.main,
    };

    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.activityItem}
        onPress={() => onActivityPress?.(activity.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.activityIcon, { backgroundColor: `${iconColors[activity.type]}20` }]}>
          <Ionicons name={activity.icon as any} size={20} color={iconColors[activity.type]} />
        </View>

        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{activity.title}</Text>
          <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
          <Text style={styles.activityTimestamp}>{activity.timestamp}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Today's Appointments Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={24} color={theme.colors.primary.main} />
          <Text style={styles.sectionTitle}>Programările de azi</Text>
          {appointments.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{appointments.length}</Text>
            </View>
          )}
        </View>

        {appointments.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color={theme.colors.neutral[300]} />
            <Text style={styles.emptyStateTitle}>Nicio programare azi</Text>
            <Text style={styles.emptyStateSubtitle}>Programul tău este liber azi</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.appointmentsScroll}
            >
              {appointments.map(renderAppointmentCard)}
            </ScrollView>

            {onViewAllAppointments && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={onViewAllAppointments}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>View All Appointments</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.primary.main} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Recent Activity Feed */}
      {activities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pulse-outline" size={24} color={theme.colors.accent.main} />
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>

          <View style={styles.activitiesFeed}>
            {activities.map(renderActivityItem)}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing['2xl'],
  },
  section: {
    gap: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.h3,
    flex: 1,
  },
  countBadge: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  countText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: '700',
  },
  appointmentsScroll: {
    paddingRight: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  appointmentCard: {
    ...theme.shadows.md,
    backgroundColor: theme.colors.surface.cream,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: 220,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
  },
  timeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: '700',
  },
  appointmentDetails: {
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  petName: {
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  ownerName: {
    ...theme.typography.bodySmall,
    color: theme.colors.neutral[600],
  },
  serviceName: {
    ...theme.typography.bodySmall,
    color: theme.colors.neutral[600],
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
  },
  viewAllText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
    gap: theme.spacing.md,
  },
  emptyStateTitle: {
    ...theme.typography.h4,
    color: theme.colors.neutral[600],
  },
  emptyStateSubtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.neutral[500],
  },
  activitiesFeed: {
    gap: theme.spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface.cream,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  activityTitle: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.neutral[900],
  },
  activitySubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.neutral[600],
  },
  activityTimestamp: {
    ...theme.typography.caption,
    color: theme.colors.neutral[500],
  },
});
