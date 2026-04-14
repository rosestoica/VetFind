import { pool } from '../config/database';
import {
  Company,
  CreateCompanyDTO,
  UpdateCompanyDTO,
  CompanySearchFilters,
} from '../types/company.types';
import { toCompanySlug } from '../utils/slug';

// Object literal with static-like methods for company operations
export const CompanyModel = {
  /**
   * Create a new company
   */
  async create(companyData: CreateCompanyDTO): Promise<Company> {
    const {
      user_id,
      name,
      email,
      phone,
      website,
      description,
      address,
      city,
      state,
      zip_code,
      latitude,
      longitude,
      clinic_type,
      years_in_business,
      num_veterinarians,
      logo_url,
      photos = [],
      specializations = [],
      facilities = [],
      payment_methods = [],
      opening_hours = {},
      company_completed = true, // Default to true for new companies
      emergency_available = false,
      emergency_fee = null,
      emergency_contact_phone = null,
    } = companyData;

    const slug = toCompanySlug(name);

    const query = `
      INSERT INTO companies (
        user_id, name, slug, email, phone, website, description,
        address, city, state, zip_code, latitude, longitude,
        clinic_type, years_in_business, num_veterinarians,
        logo_url, photos, specializations, facilities, payment_methods, opening_hours,
        company_completed, emergency_available, emergency_fee, emergency_contact_phone
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26
      )
      RETURNING *
    `;

    const values = [
      user_id,
      name,
      slug,
      email,
      phone,
      website || null,
      description || null,
      address,
      city,
      state,
      zip_code,
      latitude || null,
      longitude || null,
      clinic_type,
      years_in_business || null,
      num_veterinarians || null,
      logo_url || null,
      JSON.stringify(photos),
      specializations,
      facilities,
      payment_methods,
      JSON.stringify(opening_hours),
      company_completed,
      emergency_available,
      emergency_fee ?? null,
      emergency_contact_phone ?? null,
    ];

    try {
      const result = await pool.query(query, values);
      return CompanyModel._deserializeCompany(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.constraint === 'companies_user_id_key') {
          throw new Error('User already has a company profile');
        }
        if (error.constraint === 'companies_name_key') {
          throw new Error('Company name already exists');
        }
      }
      throw error;
    }
  },

  /**
   * Find company by ID
   */
  async findById(id: number): Promise<Company | null> {
    const query = 'SELECT * FROM companies WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return CompanyModel._deserializeCompany(result.rows[0]);
  },

  /**
   * Find company by URL slug (unique)
   */
  async findBySlug(slug: string): Promise<Company | null> {
    const query = 'SELECT * FROM companies WHERE slug = $1';
    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      return null;
    }

    return CompanyModel._deserializeCompany(result.rows[0]);
  },

  /**
   * Find company by user ID
   */
  async findByUserId(userId: number): Promise<Company | null> {
    const query = 'SELECT * FROM companies WHERE user_id = $1';
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return CompanyModel._deserializeCompany(result.rows[0]);
  },

  /**
   * Update company
   */
  async update(id: number, companyData: UpdateCompanyDTO): Promise<Company> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    if (companyData.name !== undefined) {
      fields.push(`name = $${paramCount}`);
      values.push(companyData.name);
      paramCount++;
      fields.push(`slug = $${paramCount}`);
      values.push(toCompanySlug(companyData.name));
      paramCount++;
    }

    if (companyData.email !== undefined) {
      fields.push(`email = $${paramCount}`);
      values.push(companyData.email);
      paramCount++;
    }

    if (companyData.phone !== undefined) {
      fields.push(`phone = $${paramCount}`);
      values.push(companyData.phone);
      paramCount++;
    }

    if (companyData.website !== undefined) {
      fields.push(`website = $${paramCount}`);
      values.push(companyData.website);
      paramCount++;
    }

    if (companyData.description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(companyData.description);
      paramCount++;
    }

    if (companyData.address !== undefined) {
      fields.push(`address = $${paramCount}`);
      values.push(companyData.address);
      paramCount++;
    }

    if (companyData.city !== undefined) {
      fields.push(`city = $${paramCount}`);
      values.push(companyData.city);
      paramCount++;
    }

    if (companyData.state !== undefined) {
      fields.push(`state = $${paramCount}`);
      values.push(companyData.state);
      paramCount++;
    }

    if (companyData.zip_code !== undefined) {
      fields.push(`zip_code = $${paramCount}`);
      values.push(companyData.zip_code);
      paramCount++;
    }

    if (companyData.latitude !== undefined) {
      fields.push(`latitude = $${paramCount}`);
      values.push(companyData.latitude);
      paramCount++;
    }

    if (companyData.longitude !== undefined) {
      fields.push(`longitude = $${paramCount}`);
      values.push(companyData.longitude);
      paramCount++;
    }

    if (companyData.clinic_type !== undefined) {
      fields.push(`clinic_type = $${paramCount}`);
      values.push(companyData.clinic_type);
      paramCount++;
    }

    if (companyData.years_in_business !== undefined) {
      fields.push(`years_in_business = $${paramCount}`);
      values.push(companyData.years_in_business);
      paramCount++;
    }

    if (companyData.num_veterinarians !== undefined) {
      fields.push(`num_veterinarians = $${paramCount}`);
      values.push(companyData.num_veterinarians);
      paramCount++;
    }

    if (companyData.logo_url !== undefined) {
      fields.push(`logo_url = $${paramCount}`);
      values.push(companyData.logo_url);
      paramCount++;
    }

    if (companyData.photos !== undefined) {
      fields.push(`photos = $${paramCount}`);
      values.push(JSON.stringify(companyData.photos));
      paramCount++;
    }

    if (companyData.specializations !== undefined) {
      fields.push(`specializations = $${paramCount}`);
      values.push(companyData.specializations);
      paramCount++;
    }

    if (companyData.facilities !== undefined) {
      fields.push(`facilities = $${paramCount}`);
      values.push(companyData.facilities);
      paramCount++;
    }

    if (companyData.payment_methods !== undefined) {
      fields.push(`payment_methods = $${paramCount}`);
      values.push(companyData.payment_methods);
      paramCount++;
    }

    if (companyData.opening_hours !== undefined) {
      fields.push(`opening_hours = $${paramCount}`);
      values.push(JSON.stringify(companyData.opening_hours));
      paramCount++;
    }

    if (companyData.is_active !== undefined) {
      fields.push(`is_active = $${paramCount}`);
      values.push(companyData.is_active);
      paramCount++;
    }

    if (companyData.company_completed !== undefined) {
      fields.push(`company_completed = $${paramCount}`);
      values.push(companyData.company_completed);
      paramCount++;
    }
    if (companyData.emergency_available !== undefined) {
      fields.push(`emergency_available = $${paramCount}`);
      values.push(companyData.emergency_available);
      paramCount++;
    }
    if (companyData.emergency_fee !== undefined && companyData.emergency_fee !== null) {
      fields.push(`emergency_fee = $${paramCount}`);
      values.push(companyData.emergency_fee);
      paramCount++;
    } else if (companyData.emergency_fee === null) {
      fields.push(`emergency_fee = $${paramCount}`);
      values.push(null);
      paramCount++;
    }
    if (companyData.emergency_contact_phone !== undefined && companyData.emergency_contact_phone !== null) {
      fields.push(`emergency_contact_phone = $${paramCount}`);
      values.push(companyData.emergency_contact_phone);
      paramCount++;
    } else if (companyData.emergency_contact_phone === null) {
      fields.push(`emergency_contact_phone = $${paramCount}`);
      values.push(null);
      paramCount++;
    }

    // Always update updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (fields.length === 1) {
      // Only updated_at would be changed
      throw new Error('No fields to update');
    }

    // Add ID as last parameter
    values.push(id);

    const query = `
      UPDATE companies
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }

    return CompanyModel._deserializeCompany(result.rows[0]);
  },

  /**
   * Delete company (hard delete)
   */
  async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM companies WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  },

  /**
   * Find all companies with optional filters
   */
  async findAll(filters?: CompanySearchFilters): Promise<Company[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build WHERE conditions
    if (filters?.city) {
      conditions.push(`LOWER(city) = LOWER($${paramCount})`);
      values.push(filters.city);
      paramCount++;
    }

    if (filters?.state) {
      conditions.push(`LOWER(state) = LOWER($${paramCount})`);
      values.push(filters.state);
      paramCount++;
    }

    if (filters?.clinic_type) {
      conditions.push(`clinic_type = $${paramCount}`);
      values.push(filters.clinic_type);
      paramCount++;
    }

    if (filters?.specialization) {
      conditions.push(`$${paramCount} = ANY(specializations)`);
      values.push(filters.specialization);
      paramCount++;
    }

    if (filters?.is_verified !== undefined) {
      conditions.push(`is_verified = $${paramCount}`);
      values.push(filters.is_verified);
      paramCount++;
    }

    // Always filter for active companies
    conditions.push('is_active = true');

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM companies
      ${whereClause}
      ORDER BY is_verified DESC, created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, values);
    return result.rows.map(row => CompanyModel._deserializeCompany(row));
  },

  /**
   * Search companies with location-based filtering (Haversine formula)
   */
  async search(filters: CompanySearchFilters): Promise<Company[]> {
    // If location-based search is requested
    if (filters.latitude && filters.longitude && filters.radius_km) {
      const radiusKm = filters.radius_km;
      const lat = filters.latitude;
      const lng = filters.longitude;

      const conditions: string[] = [];
      const values: any[] = [lat, lng, radiusKm];
      let paramCount = 4; // First 3 params are for Haversine formula

      // Add other filters
      if (filters.city) {
        conditions.push(`LOWER(city) = LOWER($${paramCount})`);
        values.push(filters.city);
        paramCount++;
      }

      if (filters.clinic_type) {
        conditions.push(`clinic_type = $${paramCount}`);
        values.push(filters.clinic_type);
        paramCount++;
      }

      if (filters.specialization) {
        conditions.push(`$${paramCount} = ANY(specializations)`);
        values.push(filters.specialization);
        paramCount++;
      }

      if (filters.is_verified !== undefined) {
        conditions.push(`is_verified = $${paramCount}`);
        values.push(filters.is_verified);
        paramCount++;
      }

      conditions.push('is_active = true');
      conditions.push('latitude IS NOT NULL');
      conditions.push('longitude IS NOT NULL');

      const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

      // Haversine formula for distance calculation
      const query = `
        SELECT *,
          (
            6371 * acos(
              cos(radians($1)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(latitude))
            )
          ) AS distance_km
        FROM companies
        WHERE (
          6371 * acos(
            cos(radians($1)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude))
          )
        ) <= $3
        ${whereClause}
        ORDER BY distance_km ASC, is_verified DESC
        LIMIT 100
      `;

      const result = await pool.query(query, values);
      return result.rows.map(row => CompanyModel._deserializeCompany(row));
    }

    // Fallback to findAll for non-location search
    return CompanyModel.findAll(filters);
  },

  /**
   * Update verification status (admin only)
   */
  async updateVerificationStatus(id: number, isVerified: boolean): Promise<Company> {
    const query = `
      UPDATE companies
      SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [isVerified, id]);

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }

    return CompanyModel._deserializeCompany(result.rows[0]);
  },

  /**
   * Update company completion status
   */
  async updateCompletionStatus(id: number, completed: boolean): Promise<Company> {
    const query = `
      UPDATE companies
      SET company_completed = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [completed, id]);

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }

    return CompanyModel._deserializeCompany(result.rows[0]);
  },

  /**
   * Recalculate and persist rating + review_count from reviews table
   */
  async updateRatingStats(companyId: number): Promise<Company | null> {
    const query = `
      WITH stats AS (
        SELECT
          COALESCE(AVG(rating), 0)::NUMERIC(3,2) AS avg_rating,
          COUNT(*)::INTEGER AS review_count
        FROM reviews
        WHERE company_id = $1
      )
      UPDATE companies c
      SET rating = stats.avg_rating,
          review_count = stats.review_count,
          updated_at = CURRENT_TIMESTAMP
      FROM stats
      WHERE c.id = $1
      RETURNING c.*;
    `;

    const result = await pool.query(query, [companyId]);
    if (!result.rows.length) return null;
    return CompanyModel._deserializeCompany(result.rows[0]);
  },

  /**
   * Count total companies
   */
  async count(): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM companies WHERE is_active = true';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count);
  },

  /**
   * Private helper: Deserialize JSONB fields from database
   */
  _deserializeCompany(row: any): Company {
    return {
      ...row,
      rating: row.rating !== undefined && row.rating !== null ? Number(row.rating) : 0,
      review_count: row.review_count !== undefined && row.review_count !== null ? Number(row.review_count) : 0,
      avg_rating: row.avg_rating !== undefined ? Number(row.avg_rating) : (row.rating !== undefined ? Number(row.rating) : 0),
      latitude: row.latitude !== undefined && row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== undefined && row.longitude !== null ? Number(row.longitude) : null,
      distance_km: row.distance_km !== undefined && row.distance_km !== null ? Number(row.distance_km) : undefined,
      photos: typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos,
      opening_hours: typeof row.opening_hours === 'string' ? JSON.parse(row.opening_hours) : row.opening_hours,
      emergency_available: row.emergency_available === true,
      emergency_fee: row.emergency_fee !== undefined && row.emergency_fee !== null ? Number(row.emergency_fee) : null,
      emergency_contact_phone: row.emergency_contact_phone ?? null,
    };
  },
};
