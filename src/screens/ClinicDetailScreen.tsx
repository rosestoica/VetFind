import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { vetApi } from '../services/vetApi';
import type { Clinic, Service, Review } from '../types/vet.types';
import { FacilityLabels, PaymentMethodLabels } from '../types/company.types';

interface ClinicDetailScreenProps {
  route: any;
  navigation: any;
}

export const ClinicDetailScreen = ({ route, navigation }: ClinicDetailScreenProps) => {
  const { clinicId } = route.params;
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'services' | 'reviews'>('services');

  useEffect(() => {
    loadClinicData();
  }, [clinicId]);

  const loadClinicData = async () => {
    try {
      setLoading(true);
      const [clinicData, servicesData, reviewsData] = await Promise.all([
        vetApi.clinics.getById(clinicId),
        vetApi.services.getByClinic(clinicId),
        vetApi.reviews.getByClinic(clinicId)
      ]);

      const persistedRating =
        typeof clinicData?.rating === 'number'
          ? clinicData.rating
          : (typeof clinicData?.avg_rating === 'number' ? clinicData.avg_rating : 0);
      const persistedCount = typeof clinicData?.review_count === 'number' ? clinicData.review_count : 0;

      // Cast to any to satisfy Clinic typing when some optional fields may be undefined
      setClinic({
        ...clinicData,
        rating: persistedRating,
        avg_rating: persistedRating,
        review_count: persistedCount,
      } as any);
      setServices(servicesData);
      setReviews(reviewsData);
    } catch (error: any) {
      console.error('Error loading clinic data:', error);
      Alert.alert('Eroare', 'Nu s-au putut încărca detaliile clinicii. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = (service?: Service) => {
    navigation.navigate('BookAppointment', {
      clinicId: clinic?.id,
      clinicName: clinic?.name,
      selectedServices: service ? [{
        id: service.id,
        company_id: clinic?.id || 0,
        category: 'custom',
        service_name: service.name,
        description: service.description,
        price_min: service.price || 0,
        price_max: service.price || 0,
        duration_minutes: service.duration_minutes,
        is_custom: true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }] : undefined,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Se încarcă detaliile clinicii...</Text>
      </View>
    );
  }

  if (!clinic) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Clinica nu a fost găsită</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.clinicName}>{clinic.name}</Text>
        {typeof clinic.rating === 'number' && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ {clinic.rating.toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({clinic.review_count ?? 0} reviews)</Text>
          </View>
        )}
      </View>

      {clinic.description && (
        <View style={styles.section}>
          <Text style={styles.description}>{clinic.description}</Text>
        </View>
      )}

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📍 Address:</Text>
          <Text style={styles.infoText}>
            {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip_code}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📞 Phone:</Text>
          <Text style={styles.infoText}>{clinic.phone}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>✉️ Email:</Text>
          <Text style={styles.infoText}>{clinic.email}</Text>
        </View>
      </View>

      {/* Facilities */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🏥 Available Facilities:</Text>
          <View style={styles.chipsRow}>
            {clinic.facilities && clinic.facilities.length > 0 ? (
              clinic.facilities.map((f) => (
                <View key={f} style={styles.chip}>
                  <Text style={styles.chipText}>{FacilityLabels[f]}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.infoText}>Nespecificat</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'services' && styles.activeTab]}
          onPress={() => setSelectedTab('services')}
        >
          <Text style={[styles.tabText, selectedTab === 'services' && styles.activeTabText]}>
            Services ({services.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'reviews' && styles.activeTab]}
          onPress={() => setSelectedTab('reviews')}
        >
          <Text style={[styles.tabText, selectedTab === 'reviews' && styles.activeTabText]}>
            Reviews ({reviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'services' ? (
        <View style={styles.servicesContainer}>
          {services.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Niciun serviciu disponibil</Text>
            </View>
          ) : (
            services.map((service) => (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.servicePrice}>{Number(service.price).toFixed(0)} lei</Text>
                </View>

                {service.description && (
                  <Text style={styles.serviceDescription}>{service.description}</Text>
                )}

                {service.duration_minutes && (
                  <Text style={styles.serviceDuration}>
                    ⏱️ Duration: {service.duration_minutes} minutes
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.bookButton}
                  onPress={() => handleBookAppointment(service)}
                >
                  <Text style={styles.bookButtonText}>Book This Service</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.generalBookButton}
            onPress={() => handleBookAppointment()}
          >
            <Text style={styles.generalBookButtonText}>Book General Appointment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.reviewsContainer}>
          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nicio recenzie încă</Text>
              <Text style={styles.emptySubtext}>Fii primul care lasă o recenzie acestei clinici!</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>
                    {review.user_name || 'Anonymous User'}
                  </Text>
                  <Text style={styles.reviewRating}>
                    {'⭐'.repeat(review.rating)}
                  </Text>
                </View>

                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}

                {review.created_at && (
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* Payment methods - visible to all pet owners at the end of the page */}
      <PaymentMethodsSection clinic={clinic} />
    </ScrollView>
  );
};
const PaymentMethodsSection: React.FC<{ clinic: Clinic }> = ({ clinic }) => {
  return (
    <View style={[styles.infoSection, { marginBottom: 30 }]}>
      <Text style={styles.infoLabel}>💳 Payment Methods:</Text>
      <View style={styles.chipsRow}>
        {clinic.payment_methods && clinic.payment_methods.length > 0 ? (
          clinic.payment_methods.map((p) => (
            <View key={p} style={styles.chip}>
              <Text style={styles.chipText}>{PaymentMethodLabels[p]}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.infoText}>Nespecificat</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 20
  },
  backButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  header: {
    backgroundColor: '#4ECDC4',
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 40
  },
  clinicName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8
  },
  reviewCount: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginTop: 10
  },
  description: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginTop: 10
  },
  infoRow: {
    marginBottom: 15
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 5
  },
  infoText: {
    fontSize: 16,
    color: '#666666'
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  activeTab: {
    borderBottomColor: '#4ECDC4'
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999'
  },
  activeTabText: {
    color: '#4ECDC4'
  },
  servicesContainer: {
    padding: 15
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    flex: 1,
    marginRight: 10
  },
  servicePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4ECDC4'
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 20
  },
  serviceDuration: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 10
  },
  bookButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  generalBookButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20
  },
  generalBookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  reviewsContainer: {
    padding: 15
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333'
  },
  reviewRating: {
    fontSize: 16
  },
  reviewComment: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 8
  },
  reviewDate: {
    fontSize: 12,
    color: '#999999'
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999'
  }
  ,
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5
  },
  chip: {
    backgroundColor: '#EFEFEF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8
  },
  chipText: {
    fontSize: 14,
    color: '#333333'
  }
});

export default ClinicDetailScreen;
