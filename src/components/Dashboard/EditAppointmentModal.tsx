import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Modal, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text, Button, TextInput, Chip, Portal } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Appointment } from '../../types/appointment.types';
import { theme } from '../../theme';
import { formatPriceRange } from '../../utils/currency';
import { getAppointmentClientPhone } from '../../utils/appointmentClientPhone';

export interface EditAppointmentModalProps {
  visible: boolean;
  appointment: Appointment;
  onSave: (data: Partial<Appointment>) => void;
  onCancel: () => void;
}

export const EditAppointmentModal = ({
  visible,
  appointment,
  onSave,
  onCancel,
}: EditAppointmentModalProps) => {
  const [appointmentDate, setAppointmentDate] = useState<Date>(new Date(appointment.appointment_date));
  const [status, setStatus] = useState<string>(
    () => (appointment.status === 'pending' ? 'confirmed' : appointment.status)
  );
  const [notes, setNotes] = useState<string>(appointment.notes || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showReasonPopup, setShowReasonPopup] = useState(false);
  const [showOtherReasonInput, setShowOtherReasonInput] = useState(false);
  const [otherReasonText, setOtherReasonText] = useState('');

  // Reset form when appointment changes
  useEffect(() => {
    setAppointmentDate(new Date(appointment.appointment_date));
    setStatus(appointment.status === 'pending' ? 'confirmed' : appointment.status);
    setNotes(appointment.notes || '');
  }, [appointment]);

  const handleSave = () => {
    const statusToSave = status === 'pending' ? 'confirmed' : status;
    const updatedData: Partial<Appointment> = {
      appointment_date: appointmentDate,
      status: statusToSave as any,
      notes: notes,
    };

    onSave(updatedData);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setAppointmentDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(appointmentDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setAppointmentDate(newDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes?: number | null) => {
    const m = Number(minutes || 0) || 0;
    if (m === 0) return '';
    if (m < 60) return `${m} min`;
    const hrs = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${hrs} h` : `${hrs}h ${rem}m`;
  };

  const { servicesList, totalDuration, totalPriceMin, totalPriceMax } = useMemo(() => {
    const a = appointment as any;
    let list: Array<{ service_name?: string; price_min?: number; price_max?: number; price?: number; duration_minutes?: number }> = [];
    if (Array.isArray(a.services) && a.services.length) {
      list = a.services;
    } else if (Array.isArray(a.selected_services) && a.selected_services.length) {
      list = a.selected_services;
    } else if (Array.isArray(a.service) && a.service.length) {
      list = a.service;
    } else if (a.service_name || a.service) {
      list = [{
        service_name: a.service_name || a.service?.service_name || 'Serviciu',
        price_min: a.service?.price_min ?? a.service_price,
        price_max: a.service?.price_max ?? a.service_price,
        duration_minutes: a.service?.duration_minutes,
      }];
    }
    const totalDuration = list.reduce((sum, s) => sum + Number(s?.duration_minutes ?? 0), 0);
    const totalPriceMin = list.reduce((sum, s) => sum + Number(s?.price_min ?? s?.price ?? 0), 0);
    const totalPriceMax = list.reduce((sum, s) => sum + Number(s?.price_max ?? s?.price ?? 0), 0);
    return { servicesList: list, totalDuration, totalPriceMin, totalPriceMax };
  }, [appointment]);

  const isPastEndTime = useMemo(() => {
    const start = new Date(appointment.appointment_date).getTime();
    const durationMin = totalDuration || 30;
    return Date.now() >= start + durationMin * 60 * 1000;
  }, [appointment.appointment_date, totalDuration]);

  const showNefinalizatSection =
    appointment.status === 'completed' ||
    ((appointment.status === 'pending' || appointment.status === 'confirmed') && isPastEndTime);

  const REASON_OPTIONS = [
    'Clientul nu s-a prezentat',
    'Rezervarea a fost pentru servicii diferite',
    'A intervenit o urgenta',
    'Altul',
  ] as const;

  const handleMarkNotCompleted = (reason: string) => {
    const newNotes = [appointment.notes || '', `Motiv nefinalizare: ${reason}`].filter(Boolean).join('\n');
    onSave({ status: 'cancelled' as any, notes: newNotes });
    setShowReasonPopup(false);
    setShowOtherReasonInput(false);
    setOtherReasonText('');
    onCancel();
  };

  const handleConfirmOtherReason = () => {
    handleMarkNotCompleted(otherReasonText.trim() || 'Altul');
  };

  const clientPhoneLine = getAppointmentClientPhone(appointment);

  return (
    <Portal>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>
               Detalii programare
              </Text>
              <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.neutral[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Client Info (Read-only) */}
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Informații client
                </Text>
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={20} color={theme.colors.neutral[600]} />
                  <Text variant="bodyMedium" style={styles.infoText}>
                    {(appointment as any).user_name || 'Client necunoscut'}
                  </Text>
                </View>
                {clientPhoneLine ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={20} color={theme.colors.neutral[600]} />
                    <Text variant="bodyMedium" style={styles.infoText}>
                      {clientPhoneLine}
                    </Text>
                  </View>
                ) : null}
                {(appointment as any).user_email && (
                  <View style={styles.infoRow}>
                    <Ionicons name="mail" size={20} color={theme.colors.neutral[600]} />
                    <Text variant="bodyMedium" style={styles.infoText}>
                      {(appointment as any).user_email}
                    </Text>
                  </View>
                )}
              </View>

              {/* Detalii programare: servicii alese, durată, preț */}
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Sumar programare
                </Text>
                <View style={styles.detailsCard}>
                  {servicesList.length > 0 ? (
                    <>
                      <Text variant="labelMedium" style={styles.detailsLabel}>Servicii alese</Text>
                      {servicesList.map((s, idx) => (
                        <View key={idx} style={styles.serviceRow}>
                          <Ionicons name="medical" size={18} color={theme.colors.primary.main} />
                          <Text variant="bodyMedium" style={styles.serviceRowName}>
                            {s.service_name || 'Serviciu'}
                          </Text>
                          <View style={styles.serviceRowMeta}>
                            {s.duration_minutes != null && s.duration_minutes > 0 && (
                              <Text variant="bodySmall" style={styles.serviceRowMetaText}>
                                {formatDuration(s.duration_minutes)}
                              </Text>
                            )}
                            <Text variant="bodySmall" style={styles.serviceRowMetaText}>
                              {formatPriceRange(s.price_min, s.price_max ?? s.price)}
                            </Text>
                          </View>
                        </View>
                      ))}
                      <View style={styles.detailsTotals}>
                        {totalDuration > 0 && (
                          <View style={styles.detailTotalRow}>
                            <Text variant="bodySmall" style={styles.detailTotalLabel}>Durată totală:</Text>
                            <Text variant="bodyMedium" style={styles.detailTotalValue}>{formatDuration(totalDuration)}</Text>
                          </View>
                        )}
                        {(totalPriceMin > 0 || totalPriceMax > 0) && (
                          <View style={styles.detailTotalRow}>
                            <Text variant="bodySmall" style={styles.detailTotalLabel}>Preț total:</Text>
                            <Text variant="bodyMedium" style={styles.detailTotalValue}>{formatPriceRange(totalPriceMin, totalPriceMax)}</Text>
                          </View>
                        )}
                      </View>
                    </>
                  ) : (
                    <View style={styles.serviceCard}>
                      <Ionicons name="medical" size={20} color={theme.colors.primary.main} />
                      <Text variant="bodyMedium" style={styles.serviceName}>
                        {(appointment as any).service_name || 'Serviciu nespecificat'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Date & Time Picker */}
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Date & Time
                </Text>

                {/* Date Selector */}
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.dateTimeContent}>
                    <Ionicons name="calendar-outline" size={20} color={theme.colors.primary.main} />
                    <Text variant="bodyMedium" style={styles.dateTimeText}>
                      {formatDate(appointmentDate)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.neutral[400]} />
                </TouchableOpacity>

                {/* Time Selector */}
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <View style={styles.dateTimeContent}>
                    <Ionicons name="time-outline" size={20} color={theme.colors.primary.main} />
                    <Text variant="bodyMedium" style={styles.dateTimeText}>
                      {formatTime(appointmentDate)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.neutral[400]} />
                </TouchableOpacity>

                {/* Date Picker */}
                {showDatePicker && (
                  <DateTimePicker
                    value={appointmentDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}

                {/* Time Picker */}
                {showTimePicker && (
                  <DateTimePicker
                    value={appointmentDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChange}
                  />
                )}
              </View>

              {/* Nefinalizat: doar pentru programări deja finalizate automat */}
              {showNefinalizatSection && (
                <View style={styles.section}>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    {appointment.status === 'completed' ? 'Programare finalizată automat' : 'Programare trecută de ora de încheiere'}
                  </Text>
                  <Text variant="bodySmall" style={styles.completionHint}>
                    {appointment.status === 'completed'
                      ? 'Programarea a fost trecută automat ca finalizată. Dacă nu s-a realizat, apăsați Nefinalizat și alegeți motivul.'
                      : 'Programarea a trecut de ora de încheiere. Dacă nu s-a realizat, apăsați Nefinalizat și alegeți motivul.'}
                  </Text>
                  <Button
                    mode="outlined"
                    onPress={() => setShowReasonPopup(true)}
                    style={styles.nefinalizatButton}
                    labelStyle={styles.nefinalizatButtonLabel}
                    icon="close-circle-outline"
                  >
                    Nefinalizat
                  </Button>
                </View>
              )}

              {/* Status Selector (ascuns când e afișat Nefinalizat) */}
              {!showNefinalizatSection && (
                <View style={styles.section}>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    Status programare
                  </Text>
                  <View style={styles.statusChips}>
                    <Chip
                      mode={status === 'confirmed' ? 'flat' : 'outlined'}
                      selected={status === 'confirmed'}
                      onPress={() => setStatus('confirmed')}
                      style={[
                        styles.statusChip,
                        status === 'confirmed' && { backgroundColor: theme.colors.success[100] },
                      ]}
                      textStyle={[
                        styles.statusChipText,
                        status === 'confirmed' && { color: theme.colors.success.main },
                      ]}
                    >
                      Confirmat
                    </Chip>
                    <Chip
                      mode={status === 'cancelled' ? 'flat' : 'outlined'}
                      selected={status === 'cancelled'}
                      onPress={() => setStatus('cancelled')}
                      style={[
                        styles.statusChip,
                        status === 'cancelled' && { backgroundColor: theme.colors.error[100] },
                      ]}
                      textStyle={[
                        styles.statusChipText,
                        status === 'cancelled' && { color: theme.colors.error.main },
                      ]}
                    >
                      Anulat
                    </Chip>
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Note
                </Text>
                <TextInput
                  mode="outlined"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Adaugă note sau comentarii..."
                  multiline
                  numberOfLines={4}
                  style={styles.notesInput}
                  outlineColor={theme.colors.neutral[300]}
                  activeOutlineColor={theme.colors.primary.main}
                />
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={onCancel}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonLabel}
              >
                Anulare
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.saveButton}
                labelStyle={styles.saveButtonLabel}
                buttonColor={theme.colors.primary.main}
              >
                Salvează modificările
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Popup motive nefinalizare */}
      <Modal
        visible={showReasonPopup}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowReasonPopup(false); setShowOtherReasonInput(false); setOtherReasonText(''); }}
      >
        <TouchableOpacity
          style={styles.reasonOverlay}
          activeOpacity={1}
          onPress={() => { setShowReasonPopup(false); setShowOtherReasonInput(false); setOtherReasonText(''); }}
        >
          <View style={styles.reasonPopup} onStartShouldSetResponder={() => true}>
            {!showOtherReasonInput ? (
              <>
                <Text variant="titleMedium" style={styles.reasonPopupTitle}>Motive</Text>
                <Text variant="bodySmall" style={styles.reasonPopupSubtitle}>
                  Selectați motivul pentru care programarea nu a fost finalizată:
                </Text>
                {REASON_OPTIONS.map((reason) => (
                  reason === 'Altul' ? (
                    <TouchableOpacity
                      key={reason}
                      style={styles.reasonOption}
                      onPress={() => setShowOtherReasonInput(true)}
                    >
                      <Text variant="bodyMedium" style={styles.reasonOptionText}>{reason}</Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.neutral[500]} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={reason}
                      style={styles.reasonOption}
                      onPress={() => handleMarkNotCompleted(reason)}
                    >
                      <Text variant="bodyMedium" style={styles.reasonOptionText}>{reason}</Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.neutral[500]} />
                    </TouchableOpacity>
                  )
                ))}
                <Button
                  mode="outlined"
                  onPress={() => { setShowReasonPopup(false); setShowOtherReasonInput(false); setOtherReasonText(''); }}
                  style={styles.reasonCancelButton}
                  labelStyle={styles.reasonCancelLabel}
                >
                  Anulare
                </Button>
              </>
            ) : (
              <>
                <Text variant="titleMedium" style={styles.reasonPopupTitle}>Altul</Text>
                <Text variant="bodySmall" style={styles.reasonPopupSubtitle}>
                  Scrieți motivul nefinalizării:
                </Text>
                <TextInput
                  mode="outlined"
                  value={otherReasonText}
                  onChangeText={setOtherReasonText}
                  placeholder="Introduceți motivul..."
                  multiline
                  numberOfLines={3}
                  style={styles.reasonOtherInput}
                  outlineColor={theme.colors.neutral[300]}
                  activeOutlineColor={theme.colors.primary.main}
                />
                <View style={styles.reasonOtherActions}>
                  <Button
                    mode="outlined"
                    onPress={() => { setShowOtherReasonInput(false); setOtherReasonText(''); }}
                    style={styles.reasonCancelButton}
                    labelStyle={styles.reasonCancelLabel}
                  >
                    Înapoi
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleConfirmOtherReason}
                    style={styles.reasonConfirmButton}
                    labelStyle={styles.reasonConfirmLabel}
                  >
                    Confirmă
                  </Button>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.border,
  },
  modalTitle: {
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontWeight: '600',
    color: theme.colors.neutral[700],
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    color: theme.colors.neutral[800],
  },
  detailsCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
  },
  detailsLabel: {
    color: theme.colors.primary[700],
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  serviceRowName: {
    flex: 1,
    color: theme.colors.neutral[800],
    fontWeight: '600',
  },
  serviceRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  serviceRowMetaText: {
    color: theme.colors.neutral[600],
  },
  detailsTotals: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.primary[200],
  },
  detailTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  detailTotalLabel: {
    color: theme.colors.neutral[600],
  },
  detailTotalValue: {
    color: theme.colors.primary[700],
    fontWeight: '600',
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary[50],
    borderRadius: 12,
  },
  serviceName: {
    color: theme.colors.primary[700],
    fontWeight: '600',
  },
  dateTimeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
    marginBottom: theme.spacing.sm,
  },
  dateTimeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateTimeText: {
    color: theme.colors.neutral[800],
    fontWeight: '500',
  },
  statusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusChip: {
    borderRadius: 8,
  },
  statusChipText: {
    fontWeight: '600',
    fontSize: 13,
  },
  completionHint: {
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing.md,
  },
  nefinalizatButton: {
    flex: 1,
    borderColor: theme.colors.error.main,
  },
  nefinalizatButtonLabel: {
    color: theme.colors.error.main,
    fontWeight: '600',
  },
  reasonOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  reasonPopup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  reasonPopupTitle: {
    fontWeight: '700',
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing.xs,
  },
  reasonPopupSubtitle: {
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing.lg,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.border,
  },
  reasonOptionText: {
    color: theme.colors.neutral[800],
    flex: 1,
  },
  reasonCancelButton: {
    marginTop: theme.spacing.lg,
    borderColor: theme.colors.neutral[300],
  },
  reasonCancelLabel: {
    color: theme.colors.neutral[700],
  },
  reasonOtherInput: {
    backgroundColor: '#FFFFFF',
    minHeight: 80,
    marginBottom: theme.spacing.md,
  },
  reasonOtherActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  reasonConfirmButton: {
    flex: 1,
    backgroundColor: theme.colors.primary.main,
  },
  reasonConfirmLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surface.border,
  },
  cancelButton: {
    flex: 1,
    borderColor: theme.colors.neutral[300],
  },
  cancelButtonLabel: {
    color: theme.colors.neutral[700],
  },
  saveButton: {
    flex: 1,
  },
  saveButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
