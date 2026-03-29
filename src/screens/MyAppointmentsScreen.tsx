import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Text, Chip, Button, TextInput, Dialog, Portal, Snackbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiService } from '../services/api';
import { vetApi } from '../services/vetApi';
import type { Appointment } from '../types/vet.types';
import { theme } from '../theme';
import { translateSpecializationName } from '../constants/serviceTranslations';

interface MyAppointmentsScreenProps {
  navigation: any;
}

export const MyAppointmentsScreen = ({ navigation }: MyAppointmentsScreenProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  // Review state
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewClinicId, setReviewClinicId] = useState<number | null>(null);
  const [reviewAppointmentId, setReviewAppointmentId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(1);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewCategory, setReviewCategory] = useState<'pisica' | 'caine' | 'pasare' | 'altele'>('altele');
  const [reviewProfessionalism, setReviewProfessionalism] = useState(1);
  const [reviewEfficiency, setReviewEfficiency] = useState(1);
  const [reviewFriendliness, setReviewFriendliness] = useState(1);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const fetchMyReviews = useCallback(async () => {
    try {
      const data = await vetApi.reviews.getMyReviews();
      setMyReviews(data || []);
    } catch (err) {
      setMyReviews([]);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [filter]);

  useEffect(() => {
    fetchMyReviews();
  }, [fetchMyReviews]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getUserAppointments();

      const now = Date.now();

      const cleaned = (data || [])
        // Defensive: server may return soft-deleted entries
        .filter((a: any) => !a?.deleted)
        // Defensive: ignore invalid dates
        .filter((a: any) => Number.isFinite(new Date((a as any).appointment_date).getTime()));

      const filtered = cleaned.filter((a: any) => {
        const t = new Date((a as any).appointment_date).getTime();
        const isFuture = t >= now;
        if (filter === 'upcoming') return isFuture;
        if (filter === 'past') return !isFuture;
        return true;
      });

      // Upcoming: soonest first; Past: most recent first
      filtered.sort((a: any, b: any) => {
        const ta = new Date((a as any).appointment_date).getTime();
        const tb = new Date((b as any).appointment_date).getTime();
        if (filter === 'past' || filter === 'all') return tb - ta;
        return ta - tb;
      });

      setAppointments(filtered as any);
    } catch (error: any) {
      console.error('Error loading appointments:', error);
      Alert.alert('Eroare', 'Nu s-au putut încărca programările. Te rugăm să încerci din nou.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAppointments();
    } finally {
      setRefreshing(false);
    }
  };

  const openReview = (clinicId: number | null, appointmentId?: number | null) => {
    if (!clinicId) return;
    setReviewClinicId(clinicId);
    setReviewAppointmentId(appointmentId ?? null);
    setReviewRating(1);
    setReviewComment('');
    setReviewCategory('altele');
    setReviewProfessionalism(1);
    setReviewEfficiency(1);
    setReviewFriendliness(1);
    setReviewVisible(true);
  };

  const closeReview = () => {
    setReviewVisible(false);
    setReviewClinicId(null);
    setReviewAppointmentId(null);
    setReviewRating(1);
    setReviewComment('');
    setReviewCategory('altele');
    setReviewProfessionalism(1);
    setReviewEfficiency(1);
    setReviewFriendliness(1);
  };

  const renderStarRow = (label: string, value: number, setValue: (n: number) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ marginRight: 8, minWidth: 120, fontSize: 14 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity key={i} onPress={() => setValue(i)} style={{ padding: 2 }}>
            <MaterialCommunityIcons name={i <= value ? 'star' : 'star-outline'} size={26} color={i <= value ? '#f59e0b' : '#d1d5db'} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const submitReview = async () => {
    if (!reviewClinicId) return;
    if (reviewRating < 1 || reviewRating > 5) {
      setSnackMessage('Rating must be between 1 and 5');
      setSnackVisible(true);
      return;
    }
    try {
      setReviewSubmitting(true);
      const payload = {
        rating: reviewRating,
        comment: reviewComment,
        appointment_id: reviewAppointmentId,
        category: reviewCategory,
        professionalism: reviewProfessionalism,
        efficiency: reviewEfficiency,
        friendliness: reviewFriendliness,
      };
      await vetApi.reviews.create(reviewClinicId, payload as any);
      setSnackMessage('Mulțumim pentru review!');
      setSnackVisible(true);
      await fetchMyReviews();
      await loadAppointments();
      closeReview();
    } catch (err: any) {
      setSnackMessage(err?.message || 'Nu s-a putut salva review-ul');
      setSnackVisible(true);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCancelAppointment = (appointmentId: number) => {
    Alert.alert(
      'Anulare programare',
      'Sigur vrei să anulezi această programare?',
      [
        { text: 'Nu', style: 'cancel' },
        {
          text: 'Da',
          style: 'destructive',
          onPress: async () => {
            try {
              const ok = await ApiService.cancelAppointment(appointmentId);
              if (!ok) throw new Error('Failed to cancel appointment');
              Alert.alert('Succes', 'Programarea a fost anulată cu succes.');
              loadAppointments();
            } catch (error: any) {
              Alert.alert('Eroare', error.message || 'Nu s-a putut anula programarea.');
            }
          }
        }
      ]
    );
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
        return theme.colors.info.main;
      default:
        return theme.colors.neutral[500];
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    const appointmentDate = new Date(item.appointment_date);
    const isPast = appointmentDate < new Date();
  const canCancel = item.status === 'pending' || item.status === 'confirmed';

    // Normalize services selection: support multiple shapes returned from backend
    let servicesList: Array<any> = [];
    const anyItem: any = item as any;
    if (Array.isArray(anyItem.services) && anyItem.services.length) {
      servicesList = anyItem.services;
    } else if (Array.isArray(anyItem.selected_services) && anyItem.selected_services.length) {
      servicesList = anyItem.selected_services;
    } else if (Array.isArray(anyItem.service) && anyItem.service.length) {
      servicesList = anyItem.service;
    } else if (anyItem.service_name || anyItem.service) {
      // single service fallback
      servicesList = [
        {
          service_name: anyItem.service_name || anyItem.service?.service_name || anyItem.service || 'Service',
          price_min: anyItem.service?.price_min ?? anyItem.service_price ?? anyItem.price ?? undefined,
          price_max: anyItem.service?.price_max ?? anyItem.service_price ?? anyItem.price ?? undefined,
          duration_minutes: anyItem.service?.duration_minutes ?? undefined,
        },
      ];
    }

    const totalPriceMin = servicesList.length
      ? servicesList.reduce((sum, s) => sum + Number(s?.price_min ?? s?.price ?? 0), 0)
      : 0;
    const totalPriceMax = servicesList.length
      ? servicesList.reduce((sum, s) => sum + Number(s?.price_max ?? s?.price ?? 0), 0)
      : 0;
    const totalDuration = servicesList.length
      ? servicesList.reduce((sum, s) => sum + Number(s?.duration_minutes ?? 0), 0)
      : 0;

    const formatPriceRange = (min?: number, max?: number) => {
      const minN = Number(min ?? 0) || 0;
      const maxN = Number(max ?? minN) || minN;
      if (minN === maxN) return `${minN.toFixed(0)} lei`;
      return `${minN.toFixed(0)} - ${maxN.toFixed(0)} lei`;
    };

    const formatDuration = (minutes?: number) => {
      const m = Number(minutes ?? 0) || 0;
      if (!m) return '0 min';
      if (m < 60) return `${m} min`;
      const hrs = Math.floor(m / 60);
      const rem = m % 60;
      return rem === 0 ? `${hrs} hr` : `${hrs}h ${rem}m`;
    };

    const hasServicesInNotes = (notes?: string | null) => {
      if (!notes) return false;

      // Backend sometimes duplicates services inside notes like:
      // "Notes: Also includes services: General Checkup, Microchipping"
      return /also\s+includes\s+services\s*:/i.test(notes);
    };

    return (
      <View style={styles.appointmentCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clinicName}>{item.clinic_name}</Text>
            {!!item.clinic_address && (
              <Text style={styles.subText} numberOfLines={1}>
                {item.clinic_address}
              </Text>
            )}
          </View>

          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.neutral[600]} />
                <Text style={styles.metaText}>
                {appointmentDate.toLocaleDateString()} •{' '}
                {appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
          </View>
        </View>

        <View style={styles.detailsSection}>
          {/* Services list */}
          {servicesList.length > 0 ? (
            <View style={{ marginBottom: theme.spacing.sm }}>
              <Text style={styles.detailsHeading}>Services</Text>
              {servicesList.map((s, idx) => {
                const priceText =
                  s?.price_min != null || s?.price_max != null || s?.price != null
                    ? (s?.price_min != null && s?.price_max != null
                        ? formatPriceRange(Number(s.price_min), Number(s.price_max))
                        : formatPriceRange(
                            Number(s.price ?? s.price_min ?? s.price_max ?? 0),
                            Number(s.price ?? s.price_min ?? s.price_max ?? 0)
                          ))
                    : '0 lei';
                const durationText = s?.duration_minutes ? `${Number(s.duration_minutes)} min` : '0 min';

                return (
                  <Text key={idx} style={styles.detailsLine}>
                    {translateSpecializationName(s?.service_name || s?.name || item.service_name || '') || 'Serviciu'} — {priceText} • {durationText}
                  </Text>
                );
              })}
            </View>
          ) : (
            <Text style={styles.detailsLine}>Niciun serviciu</Text>
          )}

          {/* Totals */}
          <Text style={styles.detailsLine}>
            <Text style={styles.detailLabel}>Preț:</Text> {formatPriceRange(totalPriceMin, totalPriceMax)}
          </Text>
          <Text style={styles.detailsLine}>
            <Text style={styles.detailLabel}>Durată:</Text> {formatDuration(totalDuration)}
          </Text>

          {!!item.notes && !hasServicesInNotes(item.notes) && (
            <Text style={[styles.detailsLine, { marginTop: theme.spacing.xs }]}>
              <Text style={styles.detailLabel}>Notes:</Text> {item.notes}
            </Text>
          )}

          {!!item.clinic_phone && (
            <Text style={styles.detailsLine}>
              <Text style={styles.detailLabel}>Phone:</Text> {item.clinic_phone}
            </Text>
          )}
        </View>

        {!isPast && canCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancelAppointment(item.id!)}>
            <Ionicons name="close-circle-outline" size={18} color={theme.colors.error.main} />
            <Text style={styles.cancelButtonText}>Anulare</Text>
          </TouchableOpacity>
        )}

        {String((item as any).status || item.status || '').toLowerCase() === 'completed' && (() => {
          const hasReviewed = myReviews.some((r) => (r?.appointment_id ?? (r as any)?.appointment_id) === item.id);
          if (hasReviewed) return null;
          const clinicId = (item as any).company_id ?? item.clinic_id ?? null;
          if (!clinicId) return null;
          return (
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => openReview(clinicId, item.id ?? undefined)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="star-outline" size={18} color={theme.colors.primary.main} />
              <Text style={styles.reviewButtonText}>Lasă un review</Text>
            </TouchableOpacity>
          );
        })()}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[...theme.gradients.bannerDuo]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack?.()} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>My Appointments</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={styles.filterContainer}>
        <Chip
          selected={filter === 'upcoming'}
          onPress={() => setFilter('upcoming')}
          style={[styles.filterChip, filter === 'upcoming' && styles.filterChipSelected]}
          textStyle={[styles.filterChipText, filter === 'upcoming' && styles.filterChipTextSelected]}
        >
          Viitoare
        </Chip>
        <Chip
          selected={filter === 'past'}
          onPress={() => setFilter('past')}
          style={[styles.filterChip, filter === 'past' && styles.filterChipSelected]}
          textStyle={[styles.filterChipText, filter === 'past' && styles.filterChipTextSelected]}
        >
          Trecute
        </Chip>
        <Chip
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
          style={[styles.filterChip, filter === 'all' && styles.filterChipSelected]}
          textStyle={[styles.filterChipText, filter === 'all' && styles.filterChipTextSelected]}
        >
          Toate
        </Chip>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Se încarcă programările...</Text>
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={56} color={theme.colors.neutral[300]} />
          <Text style={styles.emptyText}>Nu s-au găsit programări</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'upcoming' ? 'You have no upcoming appointments' : 'No appointments to show'}
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('UserDashboard')}
          >
            <Text style={styles.exploreButtonText}>Găsește o clinică</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={appointments}
          renderItem={renderAppointmentCard}
          keyExtractor={(item) => item.id?.toString() || '0'}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      <Portal>
        <Dialog visible={reviewVisible} onDismiss={closeReview}>
          <Dialog.Title>Lasă un review</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 6, fontSize: 14, fontWeight: '600' }}>Categorie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {(['pisica', 'caine', 'pasare', 'altele'] as const).map((cat) => (
                <Chip
                  key={cat}
                  selected={reviewCategory === cat}
                  onPress={() => setReviewCategory(cat)}
                  style={{ marginRight: 0 }}
                >
                  {cat === 'pisica' ? 'Pisică' : cat === 'caine' ? 'Câine' : cat === 'pasare' ? 'Pasăre' : 'Altele'}
                </Chip>
              ))}
            </View>

            {renderStarRow('Profesionalitate', reviewProfessionalism, setReviewProfessionalism)}
            {renderStarRow('Eficiență', reviewEfficiency, setReviewEfficiency)}
            {renderStarRow('Amabilitate', reviewFriendliness, setReviewFriendliness)}
            {renderStarRow('Overall experience', reviewRating, setReviewRating)}

            <Text style={{ marginBottom: 6, marginTop: 8, fontSize: 14, fontWeight: '600' }}>Spune-ne experiența ta:</Text>
            <TextInput
              mode="outlined"
              placeholder="Comentariu (opțional)"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={4}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeReview} mode="text">Anulare</Button>
            <Button onPress={submitReview} loading={reviewSubmitting} mode="contained">Trimite</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={3000}
        action={{ label: 'OK', onPress: () => setSnackVisible(false) }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'web' ? theme.spacing.lg : theme.spacing['2xl'],
    paddingBottom: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.border,
  },
  filterChip: {
    backgroundColor: theme.colors.surface.cream,
    borderColor: theme.colors.surface.border,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.primary.main,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.neutral[700],
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: 15,
    color: theme.colors.neutral[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['3xl'],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.neutral[800],
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.neutral[600],
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  exploreButton: {
    backgroundColor: theme.colors.accent.main,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.primarySm,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  listContainer: {
    padding: theme.spacing.lg,
  },
  appointmentCard: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.surface.border,
    ...theme.shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surface.border,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.neutral[900],
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  subText: {
    marginTop: theme.spacing.xs,
    fontSize: 13,
    color: theme.colors.neutral[600],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 0.75,
    backgroundColor: 'transparent',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.neutral[700],
  },
  cardBody: {
    marginBottom: theme.spacing.sm,
  },
  expandedDetails: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.surface.border,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  expandedHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.neutral[800],
    marginBottom: theme.spacing.xs,
  },
  // expandedLine removed: cards are no longer expandable
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.neutral[700],
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.surface.border,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  detailsHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.neutral[800],
    marginBottom: theme.spacing.xs,
  },
  detailsLine: {
    fontSize: 14,
    color: theme.colors.neutral[700],
    marginBottom: theme.spacing.xs,
  },
  detailLine: {
    fontSize: 14,
    color: theme.colors.neutral[700],
    marginBottom: theme.spacing.xs,
  },
  detailLabel: {
    fontWeight: '800',
    color: theme.colors.neutral[800],
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.22)',
  },
  cancelButtonText: {
    color: theme.colors.error.main,
    fontSize: 14,
    fontWeight: '800',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[50] || 'rgba(59, 130, 246, 0.1)',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary[200] || theme.colors.primary.main,
  },
  reviewButtonText: {
    color: theme.colors.primary.main,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default MyAppointmentsScreen;
