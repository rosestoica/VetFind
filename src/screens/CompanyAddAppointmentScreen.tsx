import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Divider, HelperText, IconButton, Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import type { RootStackParamList } from '../types/navigation.types';
import { theme } from '../theme';
import type { DayAvailability, TimeSlot } from '../types/appointment.types';

/**
 * CompanyAddAppointmentScreen
 *
 * Allows a clinic/company to add appointments manually (ex. phone bookings).
 * This is intentionally lightweight: it asks for the client's user id, service id and datetime.
 */
export const CompanyAddAppointmentScreen = () => {
	const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'CompanyAddAppointment'>>();
	const { user } = useAuth();
	const { company } = useCompany();

	const [durationMinutes, setDurationMinutes] = useState('30');
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
	const [availableDays, setAvailableDays] = useState<DayAvailability[]>([]);
	const [calendarDates, setCalendarDates] = useState<Date[]>([]);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [notes, setNotes] = useState('');
	const [submitting, setSubmitting] = useState(false);

	// Prefer CompanyContext (source of truth for vetcompany users). Keep a fallback for legacy auth payloads.
	const companyId = company?.id ?? (user as any)?.company?.id;

	const parsed = useMemo(() => {
		const dur = Number(durationMinutes);
		return {
			dur,
			isDurationValid: Number.isFinite(dur) && dur > 0 && dur <= 24 * 60,
			isSlotValid: !!selectedSlot && !!selectedSlot.datetime,
		};
	}, [durationMinutes, selectedSlot]);

	const canSubmit = !!companyId && parsed.isDurationValid && parsed.isSlotValid && !submitting;

	// Generate next 30 days for calendar
	useEffect(() => {
		const dates: Date[] = [];
		const today = new Date();
		for (let i = 0; i < 30; i++) {
			const d = new Date(today);
			d.setDate(today.getDate() + i);
			dates.push(d);
		}
		setCalendarDates(dates);
	}, []);

	const formatDate = (date: Date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	const formatTime12Hour = (time: string): string => {
		try {
			const [hStr, mStr] = time.split(':');
			let h = Number(hStr);
			const m = Number(mStr);
			const ampm = h >= 12 ? 'PM' : 'AM';
			h = h % 12;
			if (h === 0) h = 12;
			return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
		} catch {
			return time;
		}
	};

	const getDayName = (date: Date) =>
		date.toLocaleDateString('ro-RO', { weekday: 'short' });

	const getAvailabilityForDate = (date: Date): DayAvailability | undefined => {
		const dateStr = formatDate(date);
		return availableDays.find((d) => d.date === dateStr);
	};

	const getSlotsForSelectedDate = (): TimeSlot[] => {
		if (!selectedDate) return [];
		const day = getAvailabilityForDate(selectedDate);
		return day?.slots || [];
	};

	const slots = getSlotsForSelectedDate();

	const hasAvailableSlots = (date: Date): boolean => {
		const day = getAvailabilityForDate(date);
		return day?.slots?.some((s) => s.available) || false;
	};

	useEffect(() => {
		const loadAvailableSlots = async () => {
			if (!companyId || !parsed.isDurationValid) return;
			try {
				setLoadingSlots(true);
				const today = new Date();
				const end = new Date();
				end.setDate(today.getDate() + 30);
				const durationParam = parsed.dur;
				const days = await ApiService.getAvailableSlotsForDuration(
					companyId,
					formatDate(today),
					formatDate(end),
					durationParam
				);
				setAvailableDays(days || []);
			} catch (err: any) {
				console.error('Failed to load availability for manual block:', err);
				setAvailableDays([]);
			} finally {
				setLoadingSlots(false);
			}
		};
		// Reset selection when duration changes
		setSelectedSlot(null);
		loadAvailableSlots();
	}, [companyId, parsed.dur, parsed.isDurationValid]);

	const handleSubmit = async () => {
		if (!companyId) {
			Alert.alert('Companie lipsă', 'Nu s-a putut identifica clinica. Te rugăm să te autentifici din nou.');
			return;
		}
		if (!parsed.isDurationValid || !selectedSlot?.datetime) {
			Alert.alert('Date invalide', 'Completează corect toate câmpurile obligatorii.');
			return;
		}

		try {
			setSubmitting(true);

					// Manual/blocking appointment contract:
					// - blocks a slot so it can't be booked by clients
					// - should NOT show up to any client dashboards (sentinel user_id)
					// - should appear to clinic as 'confirmed'
					// - other non-relevant fields use -1 sentinel values
					const payload: any = {
						clinic_id: companyId,
						user_id: -1,
						service_id: -1,
						services: [],
						appointment_date: selectedSlot.datetime,
						status: 'confirmed',
						notes: [
							'MANUAL_BLOCK',
							`DURATION_MINUTES=${parsed.dur}`,
							notes.trim() ? notes.trim() : undefined,
						].filter(Boolean).join('\n'),
					};

			await ApiService.createAppointment(payload as any);
			navigation.navigate('CompanyManageAppointments');
		} catch (e: any) {
			Alert.alert('Eroare', e?.message || 'Nu s-a putut crea programarea.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<SafeAreaView style={styles.safe} edges={['top']}>
			<View style={styles.container}>
				<View style={styles.header}>
					<IconButton
						icon="arrow-left"
						iconColor={theme.colors.primary.main}
						size={24}
						onPress={() => navigation.goBack()}
						accessibilityLabel="Înapoi"
					/>
					<Text variant="titleLarge" style={styles.headerTitle}>
						Adaugă programare nouă
					</Text>
					<View style={styles.headerRightSpacer} />
				</View>

				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					<Text variant="bodyMedium" style={styles.subtitle}>
								Adaugă un interval blocat manual (ex. programare telefonică). Nu va apărea pentru clienți, dar va bloca intervalul.
					</Text>

					{!companyId && (
						<HelperText type="error" visible>
							Lipsește contextul companiei. Dacă ești autentificat ca clinică, te rugăm să te autentifici din nou.
						</HelperText>
					)}

								<TextInput
									mode="outlined"
									label="Durată (minute)"
									value={durationMinutes}
									onChangeText={setDurationMinutes}
									keyboardType="number-pad"
									style={styles.input}
								/>
								<HelperText type={parsed.isDurationValid || durationMinutes.length === 0 ? 'info' : 'error'} visible>
									{parsed.isDurationValid || durationMinutes.length === 0 ? 'Folosit pentru a bloca intervalul.' : 'Introdu o durată validă în minute.'}
								</HelperText>

								<View style={styles.section}>
									<Text style={styles.sectionTitle}>Alege data</Text>
										<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarScroll}>
											{calendarDates.map((date, index) => {
												const isSelected = selectedDate && formatDate(selectedDate) === formatDate(date);
												const isAvailable = hasAvailableSlots(date);
												const isPast = date < new Date();
												const dayName = getDayName(date);
												return (
													<TouchableOpacity
														key={index}
														style={[
															styles.dateCard,
															isSelected && styles.dateCardSelected,
															(!isAvailable || isPast) && styles.dateCardDisabled,
														]}
														onPress={() => {
															setSelectedDate(date);
															setSelectedSlot(null);
														}}
														disabled={!isAvailable || isPast}
														activeOpacity={0.7}
													>
														<Text style={[styles.dateDayName, isSelected && styles.dateTextSelected, (!isAvailable || isPast) && styles.dateTextDisabled]}>
															{dayName}
														</Text>
														<Text style={[styles.dateNumber, isSelected && styles.dateTextSelected, (!isAvailable || isPast) && styles.dateTextDisabled]}>
															{date.getDate()}
														</Text>
														{isAvailable && !isSelected && <View style={styles.availableDot} />}
													</TouchableOpacity>
												);
											})}
										</ScrollView>
								</View>

								{selectedDate && (
									<View style={styles.section}>
										<Text style={styles.sectionTitle}>
											Intervale disponibile - {selectedDate.toLocaleDateString('ro-RO', { month: 'long', day: 'numeric' })}
										</Text>
										{loadingSlots ? (
											<View style={styles.loadingContainer}>
												<ActivityIndicator size="small" color={theme.colors.primary.main} />
												<Text style={styles.loadingText}>Se încarcă intervalele...</Text>
											</View>
										) : slots.length === 0 ? (
											<HelperText type="info" visible>
												Nu există intervale disponibile pentru această dată (cu durata selectată).
											</HelperText>
										) : (
											<View style={styles.slotsGrid}>
												{slots.map((slot, index) => {
													const isSelected = selectedSlot?.datetime === slot.datetime;
													const isSelectable = slot.available;
													return (
														<TouchableOpacity
															key={index}
															style={[
																styles.slotChip,
																isSelected && styles.slotChipSelected,
																!isSelectable && styles.slotChipDisabled,
														]}
															onPress={() => setSelectedSlot(slot)}
															disabled={!isSelectable}
															activeOpacity={0.7}
														>
															<Text style={[styles.slotText, isSelected && styles.slotTextSelected, !isSelectable && styles.slotTextDisabled]}>
																{formatTime12Hour(slot.time)}
															</Text>
														</TouchableOpacity>
													);
												})}
											</View>
										)}
									</View>
								)}

					<TextInput
						mode="outlined"
						label="Note (opțional)"
						value={notes}
						onChangeText={setNotes}
						multiline
						numberOfLines={4}
						style={styles.input}
					/>

					<Divider style={styles.divider} />

					<Button
						mode="contained"
						icon="plus"
						onPress={handleSubmit}
						disabled={!canSubmit}
						loading={submitting}
						style={styles.submitButton}
					>
						Creează programarea
					</Button>
				</ScrollView>
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: theme.colors.surface.cream,
	},
	container: {
		flex: 1,
		backgroundColor: theme.colors.surface.cream,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.surface.border,
		backgroundColor: theme.colors.surface.background,
	},
	headerTitle: {
		flex: 1,
		textAlign: 'center',
		color: theme.colors.neutral[900],
		fontWeight: '700',
	},
	headerRightSpacer: {
		width: 48,
	},
	content: {
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.lg,
		gap: theme.spacing.xs,
	},
	subtitle: {
		color: theme.colors.neutral[700],
		marginBottom: theme.spacing.md,
	},
	input: {
		backgroundColor: theme.colors.surface.background,
	},
	divider: {
		marginVertical: theme.spacing.lg,
	},
	submitButton: {
		borderRadius: theme.borderRadius.md,
	},
	section: {
		marginTop: theme.spacing.md,
	},
	sectionTitle: {
		...theme.typography.h4,
		fontWeight: '800',
		color: theme.colors.neutral[900],
		marginBottom: theme.spacing.sm,
	},
	calendarScroll: {
		gap: theme.spacing.sm,
		paddingVertical: theme.spacing.xs,
	},
	dateCard: {
		width: 64,
		height: 76,
		borderRadius: theme.borderRadius.lg,
		backgroundColor: theme.colors.surface.background,
		borderWidth: 1,
		borderColor: theme.colors.surface.border,
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative',
	},
	dateCardSelected: {
		backgroundColor: theme.colors.primary.main,
		borderColor: theme.colors.primary.main,
	},
	dateCardDisabled: {
		opacity: 0.45,
	},
	dateDayName: {
		...theme.typography.bodySmall,
		color: theme.colors.neutral[600],
		fontWeight: '700',
	},
	dateNumber: {
		fontSize: 20,
		fontWeight: '900',
		color: theme.colors.neutral[900],
		marginTop: 2,
	},
	dateTextSelected: {
		color: theme.colors.white,
	},
	dateTextDisabled: {
		color: theme.colors.neutral[500],
	},
	availableDot: {
		position: 'absolute',
		bottom: 8,
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: theme.colors.success.main,
	},
	loadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: theme.spacing.sm,
		paddingVertical: theme.spacing.sm,
	},
	loadingText: {
		color: theme.colors.neutral[700],
	},
	slotsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: theme.spacing.sm,
	},
	slotChip: {
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		borderRadius: theme.borderRadius.lg,
		borderWidth: 1,
		borderColor: theme.colors.neutral[300],
		backgroundColor: theme.colors.surface.background,
		minWidth: 92,
		alignItems: 'center',
	},
	slotChipSelected: {
		backgroundColor: theme.colors.accent.main,
		borderColor: theme.colors.accent.main,
	},
	slotChipDisabled: {
		opacity: 0.4,
	},
	slotText: {
		color: theme.colors.neutral[900],
		fontWeight: '800',
	},
	slotTextSelected: {
		color: theme.colors.white,
	},
	slotTextDisabled: {
		color: theme.colors.neutral[500],
	},
});
