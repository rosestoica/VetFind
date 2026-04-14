import {
  LoginCredentials,
  SignupData,
  AuthResponse,
  RefreshResponse,
  VerifyResponse,
  User,
  AuthTokens
} from '../types/auth.types';
import {
  Company,
  CreateCompanyDTO,
  UpdateCompanyDTO,
  CompanyService,
  CreateServiceDTO,
  UpdateServiceDTO,
  ServiceTemplate,
  CompanyApiResponse,
  ServicesApiResponse,
  ServiceTemplatesApiResponse,
  // New types for Phase 2
  CategoryWithSpecializations,
  CategorySpecialization,
  CategoriesWithSpecializationsApiResponse,
  CategoryWithSpecializationsApiResponse,
  SpecializationsApiResponse,
} from '../types/company.types';
import {
  RouteDistance,
  RouteDistancesResponse,
  RouteStatusResponse,
} from '../types/routes.types';
import {
  Appointment,
  CreateAppointmentDTO,
  TimeSlot,
  DayAvailability,
  AvailabilityResponse,
  CreateAppointmentResponse,
  UserAppointmentsResponse,
  CancelAppointmentResponse,
} from '../types/appointment.types';

// API Base URL Configuration
// All services run in WSL, so we use localhost for communication
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

// Factory function to create API service
const createApiService = () => {
  const baseUrl = BASE_URL;

  /**
   * Make API request with proper headers
   */
  const request = async (
    endpoint: string,
    method: string = 'GET',
    body?: any,
    accessToken?: string
  ): Promise<any> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth token if provided (cast to any to allow indexing HeadersInit)
    if (accessToken) {
      (headers as any)['Authorization'] = `Bearer ${accessToken}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        // Extract error message, handling various response formats
        let errorMessage = 'Request failed';

        // Handle direct message property
        if (typeof data.message === 'string' && data.message) {
          errorMessage = data.message;
        }
        // Handle error.message structure (from error middleware)
        else if (data.error && typeof data.error.message === 'string') {
          errorMessage = data.error.message;
        }
        // Handle direct error string
        else if (typeof data.error === 'string' && data.error) {
          errorMessage = data.error;
        }
        // Last resort: stringify the error object
        else if (data.error) {
          try {
            errorMessage = JSON.stringify(data.error);
          } catch {
            errorMessage = 'An error occurred';
          }
        }

        const error = new Error(errorMessage);
        error.name = 'ApiError';
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('API request error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(error?.message || String(error) || 'Network request failed');
    }
  };

  return {
    /**
     * Generic request method for authenticated API calls
     */
    async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
      // Get access token from AsyncStorage if needed for authenticated requests
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        (headers as any)['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    },

    /**
     * Login user
     */
    async login(credentials: LoginCredentials): Promise<{ user: User; accessToken: string; refreshToken: string }> {
      try {
        const response: AuthResponse = await request('/auth/login', 'POST', credentials);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Login failed');
        }

        return {
          user: response.data.user,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken
        };
      } catch (error: any) {
        throw new Error(error.message || 'Login failed');
      }
    },

    /**
     * Sign up new user
     */
    async signup(data: SignupData): Promise<{ user: User; accessToken: string; refreshToken: string }> {
      try {
        const response: AuthResponse = await request('/auth/signup', 'POST', data);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Signup failed');
        }

        return {
          user: response.data.user,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken
        };
      } catch (error: any) {
        throw new Error(error.message || 'Signup failed');
      }
    },

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken: string): Promise<AuthTokens> {
      try {
        const response: RefreshResponse = await request('/auth/refresh', 'POST', { refreshToken });

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Token refresh failed');
        }

        return {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken
        };
      } catch (error: any) {
        throw new Error(error.message || 'Token refresh failed');
      }
    },

    /**
     * Verify current access token
     */
    async verifyToken(accessToken: string): Promise<User> {
      try {
        const response: VerifyResponse = await request('/auth/verify', 'GET', undefined, accessToken);

        if (!response.success || !response.data) {
          throw new Error('Token verification failed');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Token verification failed');
      }
    },

    /**
     * Update a user profile (used for Pet Owner settings/home address).
     */
    async updateUser(id: number, data: Partial<User>, accessToken?: string): Promise<User> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response = await request(`/users/${id}`, 'PUT', data, token || undefined);
        if (!response?.success || !response?.data) {
          throw new Error(response?.message || 'Failed to update user');
        }
        return response.data as User;
      } catch (error: any) {
        throw new Error(error.message || 'Failed to update user');
      }
    },

    // ==================== Company Methods ====================

    /**
     * Create a new company profile
     */
    async createCompany(data: CreateCompanyDTO, accessToken?: string): Promise<Company> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response: CompanyApiResponse = await request('/companies', 'POST', data, token || undefined);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Company creation failed');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Company creation failed');
      }
    },

    /**
     * Get current user's company profile
     */
    async getMyCompany(accessToken?: string): Promise<Company | null> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response: CompanyApiResponse = await request('/companies/my-company', 'GET', undefined, token || undefined);

        if (!response.success) {
          return null;
        }

        return response.data || null;
      } catch (error: any) {
        console.error('Get my company error:', error);
        return null;
      }
    },

    /**
     * Get company by ID (public)
     */
    async getCompanyById(id: number): Promise<Company | null> {
      try {
        const response: CompanyApiResponse = await request(`/companies/${id}`, 'GET');

        if (!response.success || !response.data) {
          return null;
        }

        return response.data;
      } catch (error: any) {
        console.error('Get company error:', error);
        return null;
      }
    },

    /**
     * Get company by URL slug (public).
     */
    async getCompanyBySlug(slug: string): Promise<Company | null> {
      try {
        const response: CompanyApiResponse = await request(`/companies/slug/${encodeURIComponent(slug)}`, 'GET');
        if (!response.success || !response.data) {
          return null;
        }
        return response.data;
      } catch (error: any) {
        console.error('Get company by slug error:', error);
        return null;
      }
    },

    /**
     * Update company profile
     */
    async updateCompany(id: number, data: UpdateCompanyDTO, accessToken?: string): Promise<Company> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response: CompanyApiResponse = await request(`/companies/${id}`, 'PUT', data, token || undefined);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Company update failed');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Company update failed');
      }
    },

    /**
     * Delete company profile
     */
    async deleteCompany(id: number, accessToken?: string): Promise<boolean> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        await request(`/companies/${id}`, 'DELETE', undefined, token || undefined);
        return true;
      } catch (error: any) {
        console.error('Delete company error:', error);
        return false;
      }
    },

    /**
     * Upload company photo
     */
    async uploadCompanyPhoto(companyId: number, photo: string | FormData, accessToken?: string): Promise<any> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        let formData: FormData;

        if (photo instanceof FormData) {
          formData = photo;
        } else {
          // photo is a URI or data URL
          formData = new FormData();
          if ((photo as string).startsWith('data:')) {
            const blob = await fetch(photo as string).then((r) => r.blob());
            formData.append('photo', blob, 'photo.jpg');
          } else {
            const filename = (photo as string).split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';
            formData.append('photo', {
              uri: photo as string,
              name: filename,
              type,
            } as any);
          }
        }

        const headers: HeadersInit = {};
        if (token) {
          (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${baseUrl}/companies/${companyId}/photos`, {
          method: 'POST',
          headers,
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Photo upload failed');
        }

        // Return full response object for consistency
        return data;
      } catch (error: any) {
        throw new Error(error.message || 'Photo upload failed');
      }
    },

    /**
     * Upload company logo (uses update endpoint)
     */
    async uploadCompanyLogo(companyId: number, logo: string | FormData, accessToken?: string): Promise<any> {
      try {
        // First upload as photo to get the URL
        const uploadResponse = await this.uploadCompanyPhoto(companyId, logo, accessToken);
        const logoUrl = uploadResponse.data.photo_url;

        // Then update company with logo_url
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const updateResponse = await request(
          `/companies/${companyId}`,
          'PATCH',
          { logo_url: logoUrl },
          token || undefined
        );

        if (!updateResponse.success) {
          throw new Error(updateResponse.message || 'Failed to set logo');
        }

        return {
          success: true,
          message: 'Logo uploaded successfully',
          data: {
            logo_url: logoUrl,
          },
        };
      } catch (error: any) {
        throw new Error(error.message || 'Logo upload failed');
      }
    },

    /**
     * Delete company photo
     */
    async deleteCompanyPhoto(companyId: number, photoUrl: string, accessToken?: string): Promise<boolean> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        // Backend expects JSON body: { photo_url }
        await request(
          `/companies/${companyId}/photos`,
          'DELETE',
          { photo_url: photoUrl },
          token || undefined
        );
        return true;
      } catch (error: any) {
        console.error('Delete photo error:', error);
        return false;
      }
    },

    /**
     * Search companies with filters (public)
     */
    async searchCompanies(filters?: {
      city?: string;
      state?: string;
      clinic_type?: string;
      specialization?: string;
      latitude?: number;
      longitude?: number;
      radius_km?: number;
      is_verified?: boolean;
    }): Promise<Company[]> {
      try {
        const queryParams = new URLSearchParams();

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              queryParams.append(key, String(value));
            }
          });
        }

        const endpoint = `/companies${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const response = await request(endpoint, 'GET');

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Search companies error:', error);
        return [];
      }
    },

    /**
     * Get clinics available now: open (no confirmed appointment in progress) and optionally emergency-only list.
     * Requires auth (pet owner). Emergency list only if user has show_emergency_clinics.
     */
    async getAvailableNow(accessToken?: string): Promise<{ openNow: Company[]; emergencyOnly: Company[] }> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response = await request('/companies/available-now', 'GET', undefined, token || undefined);
        if (!response.success || !response.data) {
          return { openNow: [], emergencyOnly: [] };
        }
        const { openNow = [], emergencyOnly = [] } = response.data;
        return { openNow, emergencyOnly };
      } catch (error: any) {
        console.error('getAvailableNow error:', error);
        return { openNow: [], emergencyOnly: [] };
      }
    },

    // ==================== Company Service Methods ====================

    /**
     * Create a new service for a company
     */
    async createService(companyId: number, data: CreateServiceDTO, accessToken?: string): Promise<CompanyService> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response = await request(`/companies/${companyId}/services`, 'POST', data, token || undefined);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Service creation failed');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Service creation failed');
      }
    },

    /**
     * Get all services for a company (public)
     */
    async getServices(companyId: number): Promise<CompanyService[]> {
      try {
        const response: ServicesApiResponse = await request(`/companies/${companyId}/services`, 'GET');

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get services error:', error);
        return [];
      }
    },

    /**
     * Update a service
     */
    async updateService(
      companyId: number,
      serviceId: number,
      data: UpdateServiceDTO,
      accessToken?: string
    ): Promise<CompanyService> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response = await request(`/companies/${companyId}/services/${serviceId}`, 'PUT', data, token || undefined);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Service update failed');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Service update failed');
      }
    },

    /**
     * Delete a service
     */
    async deleteService(companyId: number, serviceId: number, accessToken?: string): Promise<boolean> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        await request(`/companies/${companyId}/services/${serviceId}`, 'DELETE', undefined, token || undefined);
        return true;
      } catch (error: any) {
        console.error('Delete service error:', error);
        return false;
      }
    },

    /**
     * Bulk create services for a company
     */
    async bulkCreateServices(
      companyId: number,
      services: CreateServiceDTO[],
      accessToken?: string
    ): Promise<CompanyService[]> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
        const response: ServicesApiResponse = await request(
          `/companies/${companyId}/services/bulk`,
          'POST',
          { services },
          token || undefined
        );

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Bulk service creation failed');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Bulk service creation failed');
      }
    },

    /**
     * Get service templates (public)
     */
    async getServiceTemplates(): Promise<ServiceTemplate[]> {
      try {
        const response: ServiceTemplatesApiResponse = await request('/services/templates', 'GET');

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get service templates error:', error);
        return [];
      }
    },

    // ==================== Service Categories & Specializations (Phase 2) ====================

    /**
     * Get all service categories with their specializations (hierarchical data)
     * Used in Step 3 for category/specialization picker
     */
    async getServiceCategoriesWithSpecializations(): Promise<CategoryWithSpecializations[]> {
      try {
        const response: CategoriesWithSpecializationsApiResponse = await request(
          '/service-categories/with-specializations',
          'GET'
        );

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get service categories with specializations error:', error);
        return [];
      }
    },

    /**
     * Get a single service category by ID with its specializations
     */
    async getServiceCategoryById(id: number): Promise<CategoryWithSpecializations | null> {
      try {
        const response: CategoryWithSpecializationsApiResponse = await request(
          `/service-categories/${id}`,
          'GET'
        );

        if (!response.success || !response.data) {
          return null;
        }

        return response.data;
      } catch (error: any) {
        console.error('Get service category by ID error:', error);
        return null;
      }
    },

    /**
     * Get specializations for a specific category
     */
    async getSpecializationsByCategory(categoryId: number): Promise<CategorySpecialization[]> {
      try {
        const response: SpecializationsApiResponse = await request(
          `/service-categories/${categoryId}/specializations`,
          'GET'
        );

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get specializations by category error:', error);
        return [];
      }
    },

    /**
     * Get multiple specializations by their IDs (with category info)
     * Used in Step 4 to display selected specializations for pricing
     */
    async getSpecializationsByIds(ids: number[]): Promise<CategorySpecialization[]> {
      try {
        if (ids.length === 0) {
          return [];
        }

        const response: SpecializationsApiResponse = await request(
          '/service-categories/specializations/by-ids',
          'POST',
          { ids }
        );

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get specializations by IDs error:', error);
        return [];
      }
    },

    // ==================== Google Routes API Methods ====================

    /**
     * Get driving distances from user location to multiple companies
     * Uses Google Routes API for accurate road distances and travel times
     *
     * @param userLocation - User's current GPS coordinates
     * @param companyIds - Array of company IDs to calculate distances for
     * @param accessToken - User's authentication token
     * @returns Array of route distances with driving time
     */
    async getRouteDistances(
      userLocation: { latitude: number; longitude: number },
      companyIds: string[],
      accessToken?: string
    ): Promise<RouteDistance[]> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        if (!token) {
          console.warn('No access token provided for getRouteDistances');
          return [];
        }

        if (companyIds.length === 0) {
          return [];
        }

        const response: RouteDistancesResponse = await request(
          '/routes/distances',
          'POST',
          { userLocation, companyIds },
          token
        );

        if (!response.success || !response.data) {
          console.error('Route distances request failed:', response.error);
          return [];
        }

        return response.data.distances;
      } catch (error: any) {
        const msg = String(error?.message ?? error ?? '');
        // Backend fără Google Routes — sortarea rămâne pe distanță „crow‑flight” (haversine)
        if (/not configured|routes api|google routes/i.test(msg)) {
          console.warn('Route distances indisponibile (API neconfigurată); folosește distanță estimată.');
        } else {
          console.error('Get route distances error:', error);
        }
        return [];
      }
    },

    /**
     * Check if Google Routes API is configured on the backend
     * Useful for conditional UI rendering
     */
    async getRoutesApiStatus(): Promise<{ configured: boolean; message: string }> {
      try {
        const response: RouteStatusResponse = await request('/routes/status', 'GET');

        if (!response.success || !response.data) {
          return { configured: false, message: 'Failed to check API status' };
        }

        return response.data;
      } catch (error: any) {
        console.error('Get routes API status error:', error);
        return { configured: false, message: 'Failed to check API status' };
      }
    },

    // ==================== Appointment Booking Methods ====================

    /**
     * Get available time slots for a service
     * @param companyId - Company ID
     * @param serviceId - Service ID
     * @param startDate - Start date (YYYY-MM-DD)
     * @param endDate - End date (YYYY-MM-DD), optional
     */
    async getAvailableSlots(
      companyId: number,
      serviceId: number,
      startDate: string,
      endDate?: string,
      durationMinutes?: number
    ): Promise<DayAvailability[]> {
      try {
        const queryParams = new URLSearchParams({ startDate });
        if (endDate) {
          queryParams.append('endDate', endDate);
        }
        if (durationMinutes && durationMinutes > 0) {
          queryParams.append('duration', String(durationMinutes));
        }

        const response: AvailabilityResponse = await request(
          `/appointments/availability/${companyId}/${serviceId}?${queryParams.toString()}`,
          'GET'
        );

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get available slots error:', error);
        return [];
      }
    },

    /**
     * Get available time slots for manual blocking (company side).
     * Uses durationMinutes only (no service id) so clinics can block arbitrary intervals.
     */
    async getAvailableSlotsForDuration(
      companyId: number,
      startDate: string,
      endDate?: string,
      durationMinutes?: number
    ): Promise<DayAvailability[]> {
      try {
        const queryParams = new URLSearchParams({ startDate });
        if (endDate) {
          queryParams.append('endDate', endDate);
        }
        if (durationMinutes && durationMinutes > 0) {
          queryParams.append('duration', String(durationMinutes));
        }

        const response: AvailabilityResponse = await request(
          `/appointments/availability-duration/${companyId}?${queryParams.toString()}`,
          'GET'
        );

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get duration availability error:', error);
        return [];
      }
    },

    /**
     * Create a new appointment with instant confirmation
     * @param data - Appointment data
     * @param accessToken - User's authentication token
     */
    async createAppointment(data: CreateAppointmentDTO, accessToken?: string): Promise<Appointment> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        if (!token) {
          throw new Error('Authentication required to book appointments');
        }

        const response: CreateAppointmentResponse = await request('/appointments', 'POST', data, token);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to create appointment');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Failed to create appointment');
      }
    },

    /**
     * Get user's appointments
     * @param accessToken - User's authentication token
     * @param status - Optional filter by status
     */
    async getUserAppointments(accessToken?: string, status?: string): Promise<Appointment[]> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        if (!token) {
          throw new Error('Authentication required to view appointments');
        }

        const queryParams = status ? `?status=${status}` : '';
        const response: UserAppointmentsResponse = await request(
          `/appointments/user${queryParams}`,
          'GET',
          undefined,
          token
        );

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get user appointments error:', error);
        return [];
      }
    },

    /**
     * Cancel an appointment
     * @param appointmentId - Appointment ID
     * @param accessToken - User's authentication token
     */
    async cancelAppointment(appointmentId: number, accessToken?: string): Promise<boolean> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        if (!token) {
          throw new Error('Authentication required to cancel appointments');
        }

        const response: CancelAppointmentResponse = await request(
          `/appointments/${appointmentId}/cancel`,
          'PATCH',
          undefined,
          token
        );

        return response.success;
      } catch (error: any) {
        console.error('Cancel appointment error:', error);
        return false;
      }
    },

    /**
     * Delete appointment (permanent) - only available to authorized users
     * @param appointmentId
     */
    async deleteAppointment(appointmentId: number, accessToken?: string): Promise<boolean> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        if (!token) {
          throw new Error('Authentication required to delete appointments');
        }

        // Note: backend route must support DELETE /appointments/:id
        await request(`/appointments/${appointmentId}`, 'DELETE', undefined, token);
        return true;
      } catch (error: any) {
        console.error('Delete appointment error:', error);
        return false;
      }
    },

    /**
     * Get company's appointments (for vet companies)
     * @param accessToken - Company user's authentication token
     * @param status - Optional filter by status
     */
    async getCompanyAppointments(accessToken?: string, status?: string): Promise<Appointment[]> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        if (!token) {
          throw new Error('Authentication required to view company appointments');
        }

        const queryParams = status ? `?status=${status}` : '';
        const response: UserAppointmentsResponse = await request(
          `/appointments/company${queryParams}`,
          'GET',
          undefined,
          token
        );

        if (!response.success || !response.data) {
          return [];
        }

        return response.data;
      } catch (error: any) {
        console.error('Get company appointments error:', error);
        return [];
      }
    },

    /**
     * Update an appointment (for vet companies)
     * @param appointmentId - Appointment ID
     * @param data - Updated appointment data
     * @param accessToken - Company user's authentication token
     */
    async updateAppointment(
      appointmentId: number,
      data: Partial<CreateAppointmentDTO>,
      accessToken?: string
    ): Promise<Appointment> {
      try {
        const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);

        if (!token) {
          throw new Error('Authentication required to update appointments');
        }

        const response: CreateAppointmentResponse = await request(
          `/appointments/${appointmentId}`,
          'PATCH',
          data,
          token
        );

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to update appointment');
        }

        return response.data;
      } catch (error: any) {
        throw new Error(error.message || 'Failed to update appointment');
      }
    },

    /**
     * Get single service by ID (with company details)
     * @param serviceId - Service ID
     */
    async getServiceById(serviceId: number): Promise<any | null> {
      try {
        const response = await request(`/services/${serviceId}`, 'GET');

        if (!response.success || !response.data) {
          return null;
        }

        return response.data;
      } catch (error: any) {
        console.error('Get service by ID error:', error);
        return null;
      }
    },

    // (Photo upload / delete handled by uploadCompanyPhoto / deleteCompanyPhoto implemented earlier)
  };
};

// Export singleton instance
export const ApiService = createApiService();

// Export as apiService for compatibility
export const apiService = ApiService;
