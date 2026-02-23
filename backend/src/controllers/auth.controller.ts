import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user.model';
import { RefreshTokenModel } from '../models/refreshToken.model';
import { CreateUserDTO } from '../types/user.types';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

// Factory function to create auth controller
export const createAuthController = () => {
  // Helper method to generate access and refresh tokens
  const generateTokens = async (userId: number, email: string, role: string) => {
    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      { id: userId, email, role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    // Generate refresh token (random string)
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Store refresh token in database
    await RefreshTokenModel.create({
      userId,
      token: refreshToken,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN
    });

    return { accessToken, refreshToken };
  };

  return {
    // Login endpoint
    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
          res.status(400).json({
            success: false,
            message: 'Email and password are required'
          });
          return;
        }

        // Find user by email
        const user = await UserModel.findByEmail(email);

        if (!user) {
          res.status(401).json({
            success: false,
            message: 'No account found with this email'
          });
          return;
        }

        // Verify password
        const isPasswordValid = await UserModel.verifyPassword(password, user.password);

        if (!isPasswordValid) {
          res.status(401).json({
            success: false,
            message: 'Invalid password'
          });
          return;
        }

        // Generate access and refresh tokens
        const { accessToken, refreshToken } = await generateTokens(
          user.id,
          user.email,
          user.role
        );

        // Remove password from response
        const { password: _, ...userResponse } = user;

        res.status(200).json({
          success: true,
          message: 'Login successful',
          data: {
            user: userResponse,
            accessToken,
            refreshToken
          }
        });
      } catch (error) {
        next(error);
      }
    },

    // Signup endpoint
    async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const userData: CreateUserDTO = req.body;

        // Validate required fields
        if (!userData.name || !userData.email || !userData.password) {
          res.status(400).json({
            success: false,
            message: 'Name, email, and password are required'
          });
          return;
        }

        // Validate role
        if (!userData.role || !['user', 'vetcompany'].includes(userData.role)) {
          res.status(400).json({
            success: false,
            message: 'Role must be either "user" or "vetcompany"'
          });
          return;
        }

        // Validate password strength
        if (userData.password.length < 8) {
          res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters long'
          });
          return;
        }

        // Normalize email (avoid duplicates due to casing)
        userData.email = String(userData.email).trim().toLowerCase();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
          res.status(400).json({
            success: false,
            message: 'Invalid email format'
          });
          return;
        }

        // Explicitly check for existing email to return a user-friendly error
        const existing = await UserModel.findByEmail(userData.email);
        if (existing) {
          res.status(409).json({
            success: false,
            message: 'An account with this email already exists'
          });
          return;
        }

        // Create user
        const newUser = await UserModel.create(userData);

        // Generate access and refresh tokens
        const { accessToken, refreshToken } = await generateTokens(
          newUser.id,
          newUser.email,
          newUser.role
        );

        res.status(201).json({
          success: true,
          message: 'Account created successfully',
          data: {
            user: newUser,
            accessToken,
            refreshToken
          }
        });
      } catch (error: any) {
        if (error.message === 'User with this email already exists') {
          res.status(409).json({
            success: false,
            message: error.message
          });
          return;
        }
        next(error);
      }
    },

    // Refresh token endpoint
    async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          res.status(400).json({
            success: false,
            message: 'Refresh token is required'
          });
          return;
        }

        // Verify refresh token exists and is not expired
        const tokenRecord = await RefreshTokenModel.verify(refreshToken);

        if (!tokenRecord) {
          res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token'
          });
          return;
        }

        // Get user data
        const user = await UserModel.findById(tokenRecord.user_id);

        if (!user) {
          res.status(401).json({
            success: false,
            message: 'User not found'
          });
          return;
        }

        // Generate new access token
        const accessToken = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
        );

        // Optionally generate new refresh token (rotation)
        const newRefreshToken = crypto.randomBytes(40).toString('hex');

        // Delete old refresh token
        await RefreshTokenModel.deleteByToken(refreshToken);

        // Store new refresh token
        await RefreshTokenModel.create({
          userId: user.id,
          token: newRefreshToken,
          expiresIn: REFRESH_TOKEN_EXPIRES_IN
        });

        res.status(200).json({
          success: true,
          message: 'Token refreshed successfully',
          data: {
            accessToken,
            refreshToken: newRefreshToken
          }
        });
      } catch (error) {
        next(error);
      }
    },

    // Verify token endpoint (optional - for checking if user is still authenticated)
    async verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            success: false,
            message: 'No token provided'
          });
          return;
        }

        const token = authHeader.substring(7);

        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;

          // Get fresh user data
          const user = await UserModel.findById(decoded.id);

          if (!user) {
            res.status(401).json({
              success: false,
              message: 'User not found'
            });
            return;
          }

          const { password: _, ...userResponse } = user;

          res.status(200).json({
            success: true,
            data: userResponse
          });
        } catch (error) {
          res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }
      } catch (error) {
        next(error);
      }
    }
  };
};

// Export singleton instance
export const AuthController = createAuthController();
