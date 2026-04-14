import { Request, Response, NextFunction } from 'express';
import { CompanyModel } from '../models/company.model';
import { CompanyServiceModel } from '../models/companyService.model';
import { createReviewModel } from '../models/review.model';
import { createAppointmentModel } from '../models/appointment.model';
import { CreateCompanyDTO, UpdateCompanyDTO, CompanySearchFilters, OpeningHours } from '../types/company.types';
import { pool } from '../config/database';
import fs from 'fs';

const DAY_KEYS: (keyof OpeningHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function isOpenNow(openingHours: OpeningHours | null | undefined): boolean {
  if (!openingHours) return false;
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const schedule = openingHours[dayKey];
  if (!schedule || schedule.closed || !schedule.open || !schedule.close) return false;
  const [openH, openM] = schedule.open.split(':').map(Number);
  const [closeH, closeM] = schedule.close.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

// Factory function to create company controller
export const createCompanyController = () => {
  return {
    /**
     * Create a new company
     * POST /api/companies
     * Requires: authentication, role: vetcompany
     */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        console.log('=== COMPANY CREATION REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const userId = req.user?.id;

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Unauthorized: User not authenticated',
          });
          return;
        }

        console.log('User ID:', userId);

        // Check if user already has a company
        const existingCompany = await CompanyModel.findByUserId(userId);
        if (existingCompany) {
          res.status(409).json({
            success: false,
            message: 'User already has a company profile',
          });
          return;
        }

        // Support both Romanian and American field names
        // Romanian fields: street, streetNumber, county, postalCode, clinicType
        // American fields: address, state, zip_code, clinic_type
        const {
          name,
          email,
          phone,
          city,
          // Romanian address fields (prioritized)
          street,
          streetNumber,
          building,
          apartment,
          county,
          postalCode,
          clinicType,
          // American address fields (fallback)
          address,
          state,
          zip_code,
          clinic_type,
        } = req.body;

        // Map Romanian fields to internal format
        const finalAddress = street && streetNumber
          ? `${street} ${streetNumber}${building ? `, Bloc ${building}` : ''}${apartment ? `, Ap. ${apartment}` : ''}`
          : address;
        const finalState = county || state;
        const finalZipCode = postalCode || zip_code;
        const finalClinicType = clinicType || clinic_type;

        console.log('=== EXTRACTED FIELDS ===');
        console.log('name:', name);
        console.log('email:', email);
        console.log('phone:', phone);
        console.log('city:', city);
        console.log('street:', street);
        console.log('streetNumber:', streetNumber);
        console.log('county:', county);
        console.log('postalCode:', postalCode);
        console.log('clinicType:', clinicType);
        console.log('=== MAPPED FIELDS ===');
        console.log('finalAddress:', finalAddress);
        console.log('finalState:', finalState);
        console.log('finalZipCode:', finalZipCode);
        console.log('finalClinicType:', finalClinicType);

        // Validate required fields
        if (!name || !email || !phone || !finalAddress || !city || !finalState || !finalZipCode || !finalClinicType) {
          res.status(400).json({
            success: false,
            message: 'Missing required fields',
          });
          return;
        }

        // Validate description length (5-100 characters)
        if (req.body.description !== undefined && req.body.description !== null) {
          const desc = req.body.description.trim();
          if (desc.length > 0 && (desc.length < 5 || desc.length > 100)) {
            res.status(400).json({
              success: false,
              message: 'Descrierea trebuie să aibă între 5 și 100 de caractere',
            });
            return;
          }
        }

        // Create company DTO
        const companyData: CreateCompanyDTO = {
          user_id: userId,
          name,
          email,
          phone,
          website: req.body.website,
          description: req.body.description,
          address: finalAddress,
          city,
          state: finalState,
          zip_code: finalZipCode,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          clinic_type: finalClinicType,
          years_in_business: req.body.years_in_business,
          num_veterinarians: req.body.num_veterinarians,
          logo_url: req.body.logo_url,
          photos: req.body.photos || [],
          specializations: req.body.specializations || [],
          facilities: req.body.facilities || [],
          payment_methods: req.body.payment_methods || [],
          opening_hours: req.body.opening_hours || {},
          company_completed: true, // Set to true on creation via 4-step form
        };

        const company = await CompanyModel.create(companyData);

        res.status(201).json({
          success: true,
          message: 'Company created successfully',
          data: company,
        });
      } catch (error: any) {
        console.error('Error creating company:', error);
        next(error);
      }
    },

    /**
     * Get current user's company
     * GET /api/companies/my-company
     * Requires: authentication
     */
  async getMyCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const userId = req.user?.id;

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Unauthorized: User not authenticated',
          });
          return;
        }

        const company = await CompanyModel.findByUserId(userId);

        if (!company) {
          res.status(404).json({
            success: false,
            message: 'Company not found for this user',
          });
          return;
        }

        // Include services (treatments) offered by the company when returning company details
        const services = await CompanyServiceModel.findByCompanyId(company.id);

        // Include review aggregates for dashboard stats
        const reviewModel = createReviewModel();
        const appointmentModel = createAppointmentModel();

        const [avgRating, reviewCount, weeklyAppointments] = await Promise.all([
          reviewModel.getAverageRating(company.id),
          reviewModel.getReviewCount(company.id),
          appointmentModel.countRecentByClinic(company.id, 7),
        ]);

        res.status(200).json({
          success: true,
          data: {
            ...company,
            services,
            avg_rating: Number(avgRating) || 0,
            review_count: Number(reviewCount) || 0,
            weekly_appointments: Number(weeklyAppointments) || 0,
          },
        });
      } catch (error: any) {
        console.error('Error fetching company:', error);
        next(error);
      }
    },

    /**
     * Get company by ID
     * GET /api/companies/:id
     * Public endpoint
     */
    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const companyId = parseInt(req.params.id);

        if (isNaN(companyId)) {
          res.status(400).json({
            success: false,
            message: 'Invalid company ID',
          });
          return;
        }

        const company = await CompanyModel.findById(companyId);

        if (!company) {
          res.status(404).json({
            success: false,
            message: 'Company not found',
          });
          return;
        }

        // Include services (treatments) offered by the company so public users can see them
        const services = await CompanyServiceModel.findByCompanyId(companyId);

        res.status(200).json({
          success: true,
          data: {
            ...company,
            services,
          },
        });
      } catch (error: any) {
        console.error('Error fetching company by ID:', error);
        next(error);
      }
    },

    /**
     * Get company by URL slug
     * GET /api/companies/slug/:slug
     * Public endpoint
     */
    async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { slug } = req.params;

        if (!slug) {
          res.status(400).json({ success: false, message: 'Slug is required' });
          return;
        }

        const company = await CompanyModel.findBySlug(slug);

        if (!company) {
          res.status(404).json({ success: false, message: 'Company not found' });
          return;
        }

        const services = await CompanyServiceModel.findByCompanyId(company.id);

        res.status(200).json({
          success: true,
          data: { ...company, services },
        });
      } catch (error: any) {
        console.error('Error fetching company by slug:', error);
        next(error);
      }
    },

    /**
     * Update company
     * PUT /api/companies/:id
     * Requires: authentication, ownership check
     */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const userId = req.user?.id;
        const companyId = parseInt(req.params.id);

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Unauthorized: User not authenticated',
          });
          return;
        }

        if (isNaN(companyId)) {
          res.status(400).json({
            success: false,
            message: 'Invalid company ID',
          });
          return;
        }

        // Check ownership
        const existingCompany = await CompanyModel.findById(companyId);
        if (!existingCompany) {
          res.status(404).json({
            success: false,
            message: 'Company not found',
          });
          return;
        }

        if (existingCompany.user_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: You do not own this company',
          });
          return;
        }

        // Build update DTO (support both Romanian and American field names)
        const updateData: UpdateCompanyDTO = {};

        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.email !== undefined) updateData.email = req.body.email;
        if (req.body.phone !== undefined) updateData.phone = req.body.phone;
        if (req.body.website !== undefined) updateData.website = req.body.website;
        if (req.body.description !== undefined) updateData.description = req.body.description;

        // Address: support Romanian fields (street, streetNumber) or American (address)
        if (req.body.street !== undefined && req.body.streetNumber !== undefined) {
          updateData.address = `${req.body.street} ${req.body.streetNumber}${req.body.building ? `, Bloc ${req.body.building}` : ''}${req.body.apartment ? `, Ap. ${req.body.apartment}` : ''}`;
        } else if (req.body.address !== undefined) {
          updateData.address = req.body.address;
        }

        if (req.body.city !== undefined) updateData.city = req.body.city;

        // State: support Romanian (county) or American (state)
        if (req.body.county !== undefined) {
          updateData.state = req.body.county;
        } else if (req.body.state !== undefined) {
          updateData.state = req.body.state;
        }

        // Zip code: support Romanian (postalCode) or American (zip_code)
        if (req.body.postalCode !== undefined) {
          updateData.zip_code = req.body.postalCode;
        } else if (req.body.zip_code !== undefined) {
          updateData.zip_code = req.body.zip_code;
        }

        if (req.body.latitude !== undefined) updateData.latitude = req.body.latitude;
        if (req.body.longitude !== undefined) updateData.longitude = req.body.longitude;

        // Clinic type: support Romanian (clinicType) or American (clinic_type)
        if (req.body.clinicType !== undefined) {
          updateData.clinic_type = req.body.clinicType;
        } else if (req.body.clinic_type !== undefined) {
          updateData.clinic_type = req.body.clinic_type;
        }
        if (req.body.years_in_business !== undefined) updateData.years_in_business = req.body.years_in_business;
        if (req.body.num_veterinarians !== undefined) updateData.num_veterinarians = req.body.num_veterinarians;
        if (req.body.logo_url !== undefined) updateData.logo_url = req.body.logo_url;
        if (req.body.photos !== undefined) updateData.photos = req.body.photos;
        if (req.body.specializations !== undefined) updateData.specializations = req.body.specializations;
        if (req.body.facilities !== undefined) updateData.facilities = req.body.facilities;
        if (req.body.payment_methods !== undefined) updateData.payment_methods = req.body.payment_methods;
        if (req.body.opening_hours !== undefined) updateData.opening_hours = req.body.opening_hours;
        if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;
        if ('emergency_available' in req.body) updateData.emergency_available = !!req.body.emergency_available;
        if (req.body.emergency_fee !== undefined) updateData.emergency_fee = req.body.emergency_fee;
        if (req.body.emergency_contact_phone !== undefined) updateData.emergency_contact_phone = req.body.emergency_contact_phone;
        if (req.body.emergency_fee === null) updateData.emergency_fee = null;
        if (req.body.emergency_contact_phone === null) updateData.emergency_contact_phone = null;

        const updatedCompany = await CompanyModel.update(companyId, updateData);

        res.status(200).json({
          success: true,
          message: 'Company updated successfully',
          data: updatedCompany,
        });
      } catch (error: any) {
        console.error('Error updating company:', error);
        next(error);
      }
    },

    /**
     * Delete company
     * DELETE /api/companies/:id
     * Requires: authentication, ownership check
     */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const userId = req.user?.id;
        const companyId = parseInt(req.params.id);

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Unauthorized: User not authenticated',
          });
          return;
        }

        if (isNaN(companyId)) {
          res.status(400).json({
            success: false,
            message: 'Invalid company ID',
          });
          return;
        }

        // Check ownership
        const existingCompany = await CompanyModel.findById(companyId);
        if (!existingCompany) {
          res.status(404).json({
            success: false,
            message: 'Company not found',
          });
          return;
        }

        if (existingCompany.user_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: You do not own this company',
          });
          return;
        }

        await CompanyModel.delete(companyId);

        res.status(200).json({
          success: true,
          message: 'Company deleted successfully',
        });
      } catch (error: any) {
        console.error('Error deleting company:', error);
        next(error);
      }
    },

    /**
     * Search companies with filters
     * GET /api/companies?filters
     * Public endpoint
     */
    async search(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const filters: CompanySearchFilters = {};

        if (req.query.city) filters.city = req.query.city as string;
        if (req.query.state) filters.state = req.query.state as string;
        if (req.query.clinic_type) filters.clinic_type = req.query.clinic_type as any;
        if (req.query.specialization) filters.specialization = req.query.specialization as any;
        if (req.query.is_verified) filters.is_verified = req.query.is_verified === 'true';

        // Location-based search
        if (req.query.latitude && req.query.longitude && req.query.radius_km) {
          filters.latitude = parseFloat(req.query.latitude as string);
          filters.longitude = parseFloat(req.query.longitude as string);
          filters.radius_km = parseFloat(req.query.radius_km as string);
        }

        const companies = await CompanyModel.search(filters);

        res.status(200).json({
          success: true,
          count: companies.length,
          data: companies,
        });
      } catch (error: any) {
        console.error('Error searching companies:', error);
        next(error);
      }
    },

    /**
     * Get clinics available now: open (no in-progress appointment) + all closed clinics with emergency enabled.
     * GET /api/companies/available-now
     * Requires: authentication, role: user (pet owner)
     */
    async getAvailableNow(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const userId = req.user?.id;
        if (!userId) {
          res.status(401).json({ success: false, message: 'Unauthorized' });
          return;
        }

        const companies = await CompanyModel.findAll({});
        const activeCompanies = companies.filter((c: any) => c.is_active !== false);

        const now = new Date();
        const companyIdsWithInProgress = new Set<number>();
        const inProgressResult = await pool.query(
          `SELECT DISTINCT company_id FROM appointments
           WHERE status = 'confirmed'
             AND (deleted = FALSE OR deleted IS NULL)
             AND appointment_date <= $1
             AND (appointment_date + (COALESCE(total_duration_minutes, 30) || ' minutes')::interval) >= $1`,
          [now]
        );
        inProgressResult.rows.forEach((r: any) => companyIdsWithInProgress.add(Number(r.company_id)));

        const openNow: any[] = [];
        const emergencyOnly: any[] = [];

        for (const company of activeCompanies) {
          const open = isOpenNow(company.opening_hours);
          const inProgress = companyIdsWithInProgress.has(company.id);

          if (open && !inProgress) {
            openNow.push(company);
          } else if (!open && company.emergency_available === true) {
            emergencyOnly.push(company);
          }
        }

        res.status(200).json({
          success: true,
          data: { openNow, emergencyOnly },
        });
      } catch (error: any) {
        console.error('Error getAvailableNow:', error);
        next(error);
      }
    },

    /**
     * Upload company photo
     * POST /api/companies/:id/photos
     * Requires: authentication, ownership check, multer middleware
     *
     * CHANGES:
     * - OLD: Accepts { photo_url } in JSON body
     * - NEW: Accepts multipart/form-data with 'photo' field
     */
  async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const userId = req.user?.id;
        const companyId = parseInt(req.params.id);

        // ===========================
        // AUTHENTICATION CHECK
        // ===========================
        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Unauthorized: User not authenticated',
          });
          return;
        }

        if (isNaN(companyId)) {
          res.status(400).json({
            success: false,
            message: 'Invalid company ID',
          });
          return;
        }

        // ===========================
        // OWNERSHIP CHECK
        // ===========================
        const company = await CompanyModel.findById(companyId);
        if (!company) {
          res.status(404).json({
            success: false,
            message: 'Company not found',
          });
          return;
        }

        if (company.user_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: You do not own this company',
          });
          return;
        }

        // ===========================
        // FILE UPLOAD VALIDATION
        // ===========================

        // Accept either:
        // - multipart/form-data with req.file (local upload), OR
        // - JSON body with { photo_url } (e.g., Firebase Storage download URL)
        const bodyPhotoUrl = typeof (req.body as any)?.photo_url === 'string' ? String((req.body as any).photo_url).trim() : '';
        if (!req.file && !bodyPhotoUrl) {
          res.status(400).json({
            success: false,
            message: 'No file uploaded. Please select a photo.',
          });
          return;
        }

        // Check maximum photo limit (10)
        if (company.photos.length >= 10) {
          // Delete the uploaded file since we're rejecting it (only for multipart uploads)
          if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }

          res.status(400).json({
            success: false,
            message: 'Maximum 10 photos allowed',
          });
          return;
        }

        // ===========================
        // GENERATE PHOTO URL
        // ===========================

        // Generate URL:
        // - if uploaded locally: /uploads/companies/{companyId}/{filename}
        // - if provided via JSON: use provided URL (e.g., Firebase)
        let photoUrl = bodyPhotoUrl;
        if (!photoUrl) {
          // req.file is guaranteed here because we checked earlier (!req.file && !bodyPhotoUrl) return;
          photoUrl = `/uploads/companies/${companyId}/${req.file!.filename}`;
        }

        if (req.file) {
          console.log('Photo uploaded:', {
            originalName: req.file.originalname,
            savedAs: req.file.filename,
            size: req.file.size,
            path: req.file.path,
            url: photoUrl,
          });
        } else {
          console.log('Photo URL attached:', { url: photoUrl });
        }

        // ===========================
        // UPDATE DATABASE
        // ===========================

        // Add photo to photos array
        const updatedPhotos = [...company.photos, photoUrl];

        const updatedCompany = await CompanyModel.update(companyId, {
          photos: updatedPhotos,
        });

        // ===========================
        // SUCCESS RESPONSE
        // ===========================

        res.status(200).json({
          success: true,
          message: 'Photo uploaded successfully',
          data: {
            photo_url: photoUrl,
            photo_count: updatedPhotos.length,
            company: updatedCompany,
          },
        });
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        next(error);
      }
    },

    /**
     * Delete company photo
     * DELETE /api/companies/:id/photos
     * Requires: authentication, ownership check
     */
  async deletePhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const userId = req.user?.id;
        const companyId = parseInt(req.params.id);

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'Unauthorized: User not authenticated',
          });
          return;
        }

        if (isNaN(companyId)) {
          res.status(400).json({
            success: false,
            message: 'Invalid company ID',
          });
          return;
        }

        // Check ownership
        const company = await CompanyModel.findById(companyId);
        if (!company) {
          res.status(404).json({
            success: false,
            message: 'Company not found',
          });
          return;
        }

        if (company.user_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: You do not own this company',
          });
          return;
        }

        const { photo_url } = req.body;

        if (!photo_url) {
          res.status(400).json({
            success: false,
            message: 'Photo URL is required',
          });
          return;
        }

        // Remove photo from photos array
        const updatedPhotos = company.photos.filter(url => url !== photo_url);

        const updatedCompany = await CompanyModel.update(companyId, {
          photos: updatedPhotos,
        });

        res.status(200).json({
          success: true,
          message: 'Photo deleted successfully',
          data: updatedCompany,
        });
      } catch (error: any) {
        console.error('Error deleting photo:', error);
        next(error);
      }
    },
  };
};
