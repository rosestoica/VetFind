import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, IconButton, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { Appointment } from '../../types/appointment.types';
import { theme } from '../../theme';
import { EditAppointmentModal } from './EditAppointmentModal';
import { useCompany } from '../../context/CompanyContext';
import type { OpeningHours } from '../../types/company.types';

const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;
const SLOT_HEIGHT = 44;
const SLOTS_PER_HOUR = 2;
const TIME_COLUMN_WIDTH = 52;
const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

/** Parse "HH:MM" to decimal hours (e.g. "09:30" -> 9.5). */
function parseTimeToHours(time: string | null): number | null {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h + m / 60;
}

/** Min open hour and max close hour across all days (for calendar range). */
function getOpeningHoursRange(hours?: OpeningHours | null): { hourStart: number; hourEnd: number } {
  if (!hours) return { hourStart: DEFAULT_HOUR_START, hourEnd: DEFAULT_HOUR_END };
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  let minOpen: number | null = null;
  let maxClose: number | null = null;
  for (const day of days) {
    const s = hours[day];
    if (!s || s.closed || !s.open || !s.close) continue;
    const openH = parseTimeToHours(s.open);
    const closeH = parseTimeToHours(s.close);
    if (openH != null && closeH != null) {
      if (minOpen == null || openH < minOpen) minOpen = openH;
      if (maxClose == null || closeH > maxClose) maxClose = closeH;
    }
  }
  if (minOpen == null || maxClose == null) return { hourStart: DEFAULT_HOUR_START, hourEnd: DEFAULT_HOUR_END };
  return {
    hourStart: Math.floor(minOpen),
    hourEnd: Math.ceil(maxClose),
  };
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekEnd(monday: Date): Date {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatWeekRange(monday: Date): string {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  return `${monday.getDate()} - ${end.getDate()} ${end.toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })}`;
}

function getAppointmentDuration(app: Appointment): number {
  return (app as any).service?.duration_minutes ?? (app.service as any)?.duration_minutes ?? 30;
}

/** Total duration (sum of all services) for positioning and end-time. */
function getAppointmentTotalDuration(app: Appointment): number {
  const a = app as any;
  if (typeof a.total_duration_minutes === 'number' && a.total_duration_minutes > 0) {
    return a.total_duration_minutes;
  }
  let list: Array<{ duration_minutes?: number }> = [];
  if (Array.isArray(a.services) && a.services.length) list = a.services;
  else if (Array.isArray(a.selected_services) && a.selected_services.length) list = a.selected_services;
  else if (Array.isArray(a.service) && a.service.length) list = a.service;
  else if (a.service_name || a.service) list = [{ duration_minutes: a.service?.duration_minutes ?? 30 }];
  const total = list.reduce((sum, s) => sum + Number(s?.duration_minutes ?? 0), 0);
  return total || 30;
}

function isAppointmentPastEndTime(app: Appointment): boolean {
  const startDate = new Date(app.appointment_date);
  if (Number.isNaN(startDate.getTime())) return false;
  const start = startDate.getTime();
  const durationMin = getAppointmentTotalDuration(app);
  const durationMs = durationMin * 60 * 1000;
  const endTime = start + durationMs;
  return Date.now() >= endTime;
}

interface WeekCalendarViewProps {
  appointments: Appointment[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onAppointmentPress: (a: Appointment) => void;
  getStatusColor: (status: string) => string;
  /** If provided, used for block color (e.g. to show "awaiting completion" when past end time). */
  getBlockColor?: (app: Appointment) => string;
  /** Hour range for the grid: ora minimă deschidere și maximă închidere din programul clinicii. */
  hourStart: number;
  hourEnd: number;
  screenWidth: number;
  contentPadding: number;
}

function WeekCalendarView({
  appointments,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onAppointmentPress,
  getStatusColor,
  getBlockColor,
  hourStart,
  hourEnd,
  screenWidth,
  contentPadding,
}: WeekCalendarViewProps) {
  const weekEnd = getWeekEnd(weekStart);
  const dayWidth = (screenWidth - contentPadding - TIME_COLUMN_WIDTH) / 7;
  const totalSlots = (hourEnd - hourStart) * SLOTS_PER_HOUR;
  const gridHeight = totalSlots * SLOT_HEIGHT;

  const appointmentsInWeek = useMemo(() => {
    const start = weekStart.getTime();
    const end = weekEnd.getTime();
    return appointments.filter((a) => {
      const t = new Date(a.appointment_date).getTime();
      return t >= start && t <= end;
    });
  }, [appointments, weekStart, weekEnd]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const appointmentBlocks = useMemo(() => {
    return appointmentsInWeek.map((app) => {
      const d = new Date(app.appointment_date);
      const dayIndex = Math.floor((d.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex > 6) return null;
      const hours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      if (hours < hourStart || hours >= hourEnd) return null;
      const durationMin = getAppointmentDuration(app);
      const top = (hours - hourStart) * SLOT_HEIGHT * SLOTS_PER_HOUR;
      const height = Math.max(SLOT_HEIGHT, (durationMin / 30) * SLOT_HEIGHT);
      const left = TIME_COLUMN_WIDTH + dayIndex * dayWidth + 2;
      const width = dayWidth - 4;
      const timeStr = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      const color = getBlockColor ? getBlockColor(app) : getStatusColor(app.status);
      return {
        app,
        left,
        top,
        width,
        height,
        timeStr,
        color,
      };
    }).filter(Boolean) as Array<{ app: Appointment; left: number; top: number; width: number; height: number; timeStr: string; color: string }>;
  }, [appointmentsInWeek, weekStart, getStatusColor, getBlockColor, hourStart, hourEnd]);

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={onPrevWeek} style={styles.weekNavButton} accessibilityLabel="Săptămâna precedentă">
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary.main} />
          <Text variant="bodyMedium" style={styles.weekNavLabel}>Săpt. precedentă</Text>
        </TouchableOpacity>
        <Text variant="titleSmall" style={styles.weekNavTitle}>{formatWeekRange(weekStart)}</Text>
        <TouchableOpacity onPress={onNextWeek} style={styles.weekNavButton} accessibilityLabel="Săptămâna următoare">
          <Text variant="bodyMedium" style={styles.weekNavLabel}>Săpt. următoare</Text>
          <Ionicons name="chevron-forward" size={24} color={theme.colors.primary.main} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.calendarScroll} showsVerticalScrollIndicator={true}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.calendarGrid, { width: TIME_COLUMN_WIDTH + 7 * dayWidth, minWidth: screenWidth - contentPadding }]}>
            {/* Day headers */}
            <View style={[styles.calendarRow, styles.headerRow, { height: 36 }]}>
              <View style={[styles.timeCell, { width: TIME_COLUMN_WIDTH }]} />
              {weekDays.map((day, i) => (
                <View key={i} style={[styles.dayCell, { width: dayWidth }]}>
                  <Text variant="labelSmall" style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
                  <Text variant="bodySmall" style={styles.dayNum}>{day.getDate()}</Text>
                </View>
              ))}
            </View>
            {/* Time grid */}
            <View style={[styles.gridBody, { height: gridHeight }]}>
              {Array.from({ length: totalSlots }, (_, i) => {
                const hour = hourStart + Math.floor(i / SLOTS_PER_HOUR);
                const label = i % SLOTS_PER_HOUR === 0 ? `${hour.toString().padStart(2, '0')}:00` : '';
                const isHourStart = i % SLOTS_PER_HOUR === 0;
                return (
                  <View
                    key={i}
                    style={[
                      styles.calendarRow,
                      { height: SLOT_HEIGHT },
                      isHourStart && styles.calendarRowHourLine,
                    ]}
                  >
                    <View style={[styles.timeCell, { width: TIME_COLUMN_WIDTH }]}>
                      {label ? <Text variant="bodySmall" style={styles.timeLabel}>{label}</Text> : null}
                    </View>
                    {weekDays.map((_, j) => (
                      <View key={j} style={[styles.daySlot, { width: dayWidth, borderColor: theme.colors.neutral[200] }]} />
                    ))}
                  </View>
                );
              })}
            </View>
            {/* Appointment blocks overlay */}
            <View style={[styles.blocksOverlay, { width: TIME_COLUMN_WIDTH + 7 * dayWidth, height: gridHeight + 36 }]} pointerEvents="box-none">
              {appointmentBlocks.map(({ app, left, top, width, height, timeStr, color }) => (
                <TouchableOpacity
                  key={app.id}
                  style={[
                    styles.appointmentBlock,
                    {
                      left,
                      top: 36 + top,
                      width,
                      height,
                      backgroundColor: String(app.status).toLowerCase() === 'completed' ? theme.colors.primary.main : color,
                    },
                  ]}
                  onPress={() => onAppointmentPress(app)}
                  activeOpacity={0.8}
                >
                  <Text variant="labelSmall" style={styles.blockTime} numberOfLines={1}>{timeStr}</Text>
                  <Text variant="bodySmall" style={styles.blockName} numberOfLines={2}>{(app as any).user_name || 'Client'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </ScrollView>

      {appointmentsInWeek.length === 0 && (
        <View style={styles.calendarEmpty}>
          <Text variant="bodyMedium" style={styles.calendarEmptyText}>Nicio programare în această săptămână</Text>
        </View>
      )}
    </View>
  );
}

export interface ManageAppointmentsSectionProps {
  onRefresh?: () => void;
}

export const ManageAppointmentsSection = ({ onRefresh }: ManageAppointmentsSectionProps) => {
  const { company } = useCompany();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const { width: screenWidth } = useWindowDimensions();

  const { hourStart, hourEnd } = useMemo(
    () => getOpeningHoursRange(company?.opening_hours),
    [company?.opening_hours]
  );

  useEffect(() => {
    loadAppointments();
  }, [statusFilter]);

  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      const data = await ApiService.getCompanyAppointments(undefined, statusFilter);
      const toAutoComplete = data.filter(
        (a) => (a.status === 'pending' || a.status === 'confirmed') && isAppointmentPastEndTime(a)
      );

      if (toAutoComplete.length > 0) {
        const completedIds = new Set(toAutoComplete.map((a) => a.id));
        setAppointments(
          data.map((a) =>
            completedIds.has(a.id!) ? { ...a, status: 'completed' as const } : a
          )
        );
        await Promise.allSettled(
          toAutoComplete.map((a) => ApiService.updateAppointment(a.id!, { status: 'completed' } as any))
        );
        const refreshed = await ApiService.getCompanyAppointments(undefined, statusFilter);
        setAppointments(
          refreshed.map((a) => {
            if (!completedIds.has(a.id!)) return a;
            if (a.status === 'completed') return a;
            return { ...a, status: 'completed' as const };
          })
        );
      } else {
        setAppointments(data);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Eroare', 'Nu s-au putut încărca programările.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsEditModalVisible(true);
  };

  const handleAccept = async (appointment: Appointment) => {
    if (!appointment.id) return;

    // Optimistic UI: mark as confirmed immediately
    const prevStatus = appointment.status;
    setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, status: 'confirmed' } : a)));
    setBusyIds((b) => [...b, appointment.id!]);

    try {
  // Use the standard ApiService PATCH endpoint for appointment updates
  await ApiService.updateAppointment(appointment.id!, { status: 'confirmed' } as any);
      // success - reload to ensure fresh data
      loadAppointments();
      onRefresh?.();
    } catch (error: any) {
      // revert and show detailed error
      setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, status: prevStatus } : a)));
      console.error('Accept appointment error:', error);
      Alert.alert('Eroare la acceptare', (error && (error.message || String(error))) || 'Nu s-a putut accepta programarea.');
    } finally {
      setBusyIds((b) => b.filter((id) => id !== appointment.id));
    }
  };

  const handleReject = async (appointment: Appointment) => {
    if (!appointment.id) return;

    const prevStatus = appointment.status;
    setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, status: 'cancelled' } : a)));
    setBusyIds((b) => [...b, appointment.id!]);

    try {
      // Try to update the appointment status via the standard PATCH endpoint
      await ApiService.updateAppointment(appointment.id!, { status: 'cancelled' } as any);
      // success - reload to ensure fresh data
      loadAppointments();
      onRefresh?.();
    } catch (error: any) {
      // If the PATCH update fails (CORS/404/network or other), try the dedicated cancel endpoint as a fallback
      console.warn('Update to cancelled failed, attempting cancel endpoint as fallback', error);
      try {
        const cancelled = await ApiService.cancelAppointment(appointment.id!);
        if (cancelled) {
          // refresh list after successful cancel
          loadAppointments();
          onRefresh?.();
          return;
        }
        // if cancel endpoint returned false, fallthrough to revert + alert
        throw new Error('Cancel endpoint did not succeed');
      } catch (fallbackError: any) {
        // revert optimistic change
        setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, status: prevStatus } : a)));
        console.error('Cancel appointment error (fallback):', fallbackError);
        Alert.alert('Eroare la anulare', (fallbackError && (fallbackError.message || String(fallbackError))) || 'Nu s-a putut anula programarea.');
      }
    } finally {
      setBusyIds((b) => b.filter((id) => id !== appointment.id));
    }
  };

  const handleSaveAppointment = async (updatedData: Partial<Appointment>) => {
    if (!selectedAppointment) return;

    try {
      await ApiService.updateAppointment(selectedAppointment.id!, updatedData);
      Alert.alert('Succes', 'Programarea a fost actualizată.');
      setIsEditModalVisible(false);
      setSelectedAppointment(null);
      loadAppointments();
      onRefresh?.();
    } catch (error: any) {
      Alert.alert('Eroare', error.message || 'Nu s-a putut actualiza programarea.');
    }
  };

  const handleCancelModal = () => {
    setIsEditModalVisible(false);
    setSelectedAppointment(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return theme.colors.success.main;
      case 'pending':
        return theme.colors.warning.main;
      case 'cancelled':
        return theme.colors.error.main;
      case 'completed':
        return theme.colors.neutral[500];
      default:
        return theme.colors.neutral[400];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'cancelled':
        return 'close-circle';
      case 'completed':
        return 'checkmark-done-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading appointments...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="calendar" size={24} color={theme.colors.primary.main} />
          <Text variant="titleLarge" style={styles.title}>
            Gestionează programări
          </Text>
        </View>
        <Chip
          style={styles.countChip}
          textStyle={styles.countChipText}
          compact
        >
          {appointments.length}
        </Chip>
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <Chip
          mode={statusFilter === undefined ? 'flat' : 'outlined'}
          selected={statusFilter === undefined}
          onPress={() => setStatusFilter(undefined)}
          style={styles.filterChip}
          textStyle={statusFilter === undefined ? styles.filterChipTextActive : styles.filterChipText}
          compact
        >
          All
        </Chip>
        <Chip
          mode={statusFilter === 'pending' ? 'flat' : 'outlined'}
          selected={statusFilter === 'pending'}
          onPress={() => setStatusFilter('pending')}
          style={styles.filterChip}
          textStyle={statusFilter === 'pending' ? styles.filterChipTextActive : styles.filterChipText}
          compact
        >
          În așteptare
        </Chip>
        <Chip
          mode={statusFilter === 'confirmed' ? 'flat' : 'outlined'}
          selected={statusFilter === 'confirmed'}
          onPress={() => setStatusFilter('confirmed')}
          style={styles.filterChip}
          textStyle={statusFilter === 'confirmed' ? styles.filterChipTextActive : styles.filterChipText}
          compact
        >
          Confirmat
        </Chip>
        <Chip
          mode={statusFilter === 'completed' ? 'flat' : 'outlined'}
          selected={statusFilter === 'completed'}
          onPress={() => setStatusFilter('completed')}
          style={styles.filterChip}
          textStyle={statusFilter === 'completed' ? styles.filterChipTextActive : styles.filterChipText}
          compact
        >
          Finalizat
        </Chip>
        <Chip
          mode={statusFilter === 'cancelled' ? 'flat' : 'outlined'}
          selected={statusFilter === 'cancelled'}
          onPress={() => setStatusFilter('cancelled')}
          style={styles.filterChip}
          textStyle={statusFilter === 'cancelled' ? styles.filterChipTextActive : styles.filterChipText}
          compact
        >
          Anulate
        </Chip>
      </View>

      {/* All = calendar view; other filters = list */}
      {statusFilter === undefined ? (
        <WeekCalendarView
          appointments={appointments.filter((a) => a.status !== 'cancelled')}
          weekStart={weekStart}
          onPrevWeek={() => setWeekStart((prev) => { const m = new Date(prev); m.setDate(m.getDate() - 7); return m; })}
          onNextWeek={() => setWeekStart((prev) => { const m = new Date(prev); m.setDate(m.getDate() + 7); return m; })}
          onAppointmentPress={handleEditAppointment}
          getStatusColor={getStatusColor}
          getBlockColor={(app) => {
            if (String(app.status).toLowerCase() === 'completed') return theme.colors.primary.main;
            if ((app.status === 'pending' || app.status === 'confirmed') && isAppointmentPastEndTime(app)) {
              return theme.colors.info.main;
            }
            return getStatusColor(app.status);
          }}
          hourStart={hourStart}
          hourEnd={hourEnd}
          screenWidth={screenWidth}
          contentPadding={theme.spacing.lg * 2}
        />
      ) : appointments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={theme.colors.neutral[300]} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Nu s-au găsit programări
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {`Nicio programare ${({ pending: 'în așteptare', confirmed: 'confirmată', completed: 'finalizată', cancelled: 'anulată' } as Record<string, string>)[statusFilter] || statusFilter} în acest moment`}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.appointmentsList} showsVerticalScrollIndicator={false}>
          {appointments.map((appointment) => (
            <Card key={appointment.id} style={styles.appointmentCard}>
              <Card.Content style={styles.cardContent}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.dateTimeContainer}>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={16} color={theme.colors.neutral[600]} />
                      <Text variant="bodyMedium" style={styles.dateText}>
                        {formatDate(appointment.appointment_date)}
                      </Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={16} color={theme.colors.neutral[600]} />
                      <Text variant="bodyMedium" style={styles.timeText}>
                        {formatTime(appointment.appointment_date)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusContainer}>
                    <Ionicons
                      name={getStatusIcon(appointment.status) as any}
                      size={20}
                      color={getStatusColor(appointment.status)}
                    />
                    <Text
                      variant="bodySmall"
                      style={[styles.statusText, { color: getStatusColor(appointment.status) }]}
                    >
                      {({ pending: 'În așteptare', confirmed: 'Confirmat', completed: 'Finalizat', cancelled: 'Anulat' } as Record<string, string>)[appointment.status] || appointment.status}
                    </Text>
                  </View>
                </View>

                {/* Client Info */}
                <View style={styles.clientInfo}>
                  <Ionicons name="person" size={16} color={theme.colors.neutral[600]} />
                  <Text variant="bodyMedium" style={styles.clientName}>
                    {(appointment as any).user_name || 'Client necunoscut'}
                  </Text>
                </View>
                {(appointment as any).user_email && (
                  <View style={styles.clientInfo}>
                    <Ionicons name="mail" size={16} color={theme.colors.neutral[600]} />
                    <Text variant="bodySmall" style={styles.clientEmail}>
                      {(appointment as any).user_email}
                    </Text>
                  </View>
                )}

                {/* Service Info */}
                {(appointment as any).service_name && (
                  <View style={styles.serviceInfo}>
                    <Ionicons name="medical" size={16} color={theme.colors.primary.main} />
                    <Text variant="bodyMedium" style={styles.serviceName}>
                      {(appointment as any).service_name}
                    </Text>
                  </View>
                )}

                {/* Notes */}
                {appointment.notes && (
                  <View style={styles.notesContainer}>
                    <Text variant="bodySmall" style={styles.notesLabel}>
                      Note:
                    </Text>
                    <Text variant="bodySmall" style={styles.notesText}>
                      {appointment.notes}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                  <Button
                    mode="outlined"
                    onPress={() => handleEditAppointment(appointment)}
                    icon="pencil"
                    style={styles.editButton}
                    labelStyle={styles.editButtonLabel}
                    compact
                  >
                    Editează
                  </Button>
                  {appointment.status === 'pending' && (
                    <View style={styles.pendingActions}>
                      <Button
                        mode="contained"
                        onPress={() => handleAccept(appointment)}
                        style={styles.acceptButton}
                        compact
                        disabled={busyIds.includes(appointment.id)}
                      >
                        {busyIds.includes(appointment.id) ? 'Se procesează...' : 'Acceptă'}
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => handleReject(appointment)}
                        style={styles.rejectButton}
                        compact
                        disabled={busyIds.includes(appointment.id)}
                      >
                        {busyIds.includes(appointment.id) ? 'Se procesează...' : 'Anulare'}
                      </Button>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* Edit Appointment Modal */}
      {selectedAppointment && (
        <EditAppointmentModal
          visible={isEditModalVisible}
          appointment={selectedAppointment}
          onSave={handleSaveAppointment}
          onCancel={handleCancelModal}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  weekNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  weekNavLabel: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  weekNavTitle: {
    color: theme.colors.neutral[800],
    fontWeight: '700',
  },
  calendarScroll: {
    flex: 1,
  },
  calendarGrid: {
    paddingBottom: theme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarRowHourLine: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
  timeCell: {
    justifyContent: 'flex-start',
    paddingTop: 2,
    paddingRight: theme.spacing.xs,
    alignItems: 'flex-end',
  },
  timeLabel: {
    color: theme.colors.neutral[500],
    fontSize: 11,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.neutral[200],
  },
  dayLabel: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  dayNum: {
    color: theme.colors.neutral[700],
  },
  gridBody: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  daySlot: {
    borderLeftWidth: 1,
  },
  blocksOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  appointmentBlock: {
    position: 'absolute',
    borderRadius: 8,
    padding: 6,
    justifyContent: 'flex-start',
    ...theme.shadows.sm,
  },
  blockTime: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '700',
    fontSize: 11,
  },
  blockName: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
    fontSize: 12,
  },
  calendarEmpty: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  calendarEmptyText: {
    color: theme.colors.neutral[500],
  },
  loadingContainer: {
    padding: theme.spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.neutral[600],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  acceptButton: {
    marginLeft: theme.spacing.sm,
  },
  rejectButton: {
    marginLeft: theme.spacing.xs,
  },
  title: {
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  countChip: {
    backgroundColor: theme.colors.primary[100],
  },
  countChipText: {
    color: theme.colors.primary[700],
    fontWeight: '600',
  },
  filterContainer: {
    marginBottom: theme.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: theme.spacing.xs,
  },
  filterChip: {
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
  },
  filterChipText: {
    color: theme.colors.neutral[600],
    fontSize: 12,
  },
  filterChipTextActive: {
    color: theme.colors.primary.main,
    fontWeight: '600',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
  },
  emptyTitle: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    color: theme.colors.neutral[700],
    fontWeight: '600',
  },
  emptyText: {
    color: theme.colors.neutral[500],
    textAlign: 'center',
  },
  appointmentsList: {
    flex: 1,
  },
  appointmentCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  dateTimeContainer: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dateText: {
    color: theme.colors.neutral[700],
    fontWeight: '600',
  },
  timeText: {
    color: theme.colors.neutral[600],
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.neutral[50],
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 11,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  clientName: {
    color: theme.colors.neutral[800],
    fontWeight: '600',
  },
  clientEmail: {
    color: theme.colors.neutral[600],
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.primary[50],
    borderRadius: 8,
  },
  serviceName: {
    color: theme.colors.primary[700],
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.neutral[50],
    borderRadius: 8,
  },
  notesLabel: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  notesText: {
    color: theme.colors.neutral[700],
  },
  actionsContainer: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    borderColor: theme.colors.primary.main,
  },
  editButtonLabel: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
});
