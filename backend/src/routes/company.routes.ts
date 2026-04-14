import { Router } from 'express';
import { createCompanyController } from '../controllers/company.controller';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { uploadPhoto, optimizeImage } from '../middleware/upload';

const router = Router();
const companyController = createCompanyController();

// Routes are matched in order - specific routes must come before parameterized routes

// Protected user-specific route (must come before GET /:id)
router.get('/my-company', authMiddleware, companyController.getMyCompany); // Get current user's company

// Available now (pet owner: open clinics without in-progress appointment; optional emergency list)
router.get('/available-now', authMiddleware, requireRole('user'), companyController.getAvailableNow);

// Root path handlers
router.route('/')
  .get(companyController.search) // Public: Get all companies or search with filters
  .post(authMiddleware, requireRole('vetcompany'), companyController.create); // Protected: Create company

// Public: Get company by URL slug (must come before /:id)
router.get('/slug/:slug', companyController.getBySlug);

// Parameterized routes (must come after specific routes)
router.route('/:id')
  .get(companyController.getById) // Public: Get company by ID
  .put(authMiddleware, companyController.update) // Protected: Update company (full)
  .patch(authMiddleware, companyController.update) // Protected: Update company (partial, e.g. logo_url)
  .delete(authMiddleware, companyController.delete); // Protected: Delete company

// ===========================
// PHOTO MANAGEMENT ROUTES
// ===========================

// Upload photo (NEW: with multer and sharp middleware)
router.post(
  '/:id/photos',
  authMiddleware,                // 1. Authenticate user
  uploadPhoto.single('photo'),   // 2. Handle file upload (field name: 'photo')
  optimizeImage,                 // 3. Optimize image with Sharp
  companyController.uploadPhoto  // 4. Save to database
);

// Delete photo (unchanged)
router.delete('/:id/photos', authMiddleware, companyController.deletePhoto);

export default router;
