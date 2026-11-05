import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/index.js';
import { lawyerRegistrationSchema, normalizeEnrollmentNumber, firstZodError } from '../services/connect/constants.js';

const registerSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Full name is required'),
  organization: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
      }

      const { email, password, name, organization } = parseResult.data;

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        res.status(409).json({ error: 'An account with this email address already exists.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          organization: organization || 'Independent',
          role: 'USER',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organization: true,
          createdAt: true,
        },
      });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN as any }
      );

      res.status(201).json({
        message: 'Account successfully registered.',
        user,
        token,
      });
    } catch (error: any) {
      console.error('Registration failed.');
      res.status(500).json({ error: 'Server error during registration.' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: parseResult.error.errors[0].message });
        return;
      }

      const { email, password } = parseResult.data;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN as any }
      );

      res.json({
        message: 'Login successful.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organization: user.organization,
        },
        token,
      });
    } catch (error: any) {
      console.error('Login failed.');
      res.status(500).json({ error: 'Server error during login.' });
    }
  }

  /**
   * Legal Buddy Connect: creates a LAWYER account plus a DRAFT profile. The profile is not
   * public until an admin reviews the submitted credentials; registration itself proves nothing.
   */
  static async registerLawyer(req: Request, res: Response): Promise<void> {
    try {
      const parsed = lawyerRegistrationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: firstZodError(parsed.error) });
        return;
      }
      const { name, password, barCouncilState, enrollmentNumber } = parsed.data;
      const email = parsed.data.email.toLowerCase();
      const enrollmentNumberNormalized = normalizeEnrollmentNumber(enrollmentNumber);

      const [existingUser, existingEnrollment] = await Promise.all([
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
        prisma.lawyerProfile.findUnique({
          where: { barCouncilState_enrollmentNumberNormalized: { barCouncilState, enrollmentNumberNormalized } },
          select: { id: true },
        }),
      ]);
      if (existingUser) {
        res.status(409).json({ error: 'An account with this email address already exists.' });
        return;
      }
      if (existingEnrollment) {
        res.status(409).json({ error: 'A profile with this Bar Council enrollment number is already registered. Contact support if you believe this is an error.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email, passwordHash, name, role: 'LAWYER', organization: 'Independent',
          lawyerProfile: {
            create: { professionalName: name, barCouncilState, enrollmentNumber: enrollmentNumber.trim(), enrollmentNumberNormalized, contactEmail: email },
          },
        },
        select: { id: true, email: true, name: true, role: true, organization: true, createdAt: true },
      });

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
      res.status(201).json({ message: 'Lawyer account created. Complete your profile and submit it for review.', user, token });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        res.status(409).json({ error: 'This email or enrollment number is already registered.' });
        return;
      }
      console.error('Lawyer registration failed.');
      res.status(500).json({ error: 'Server error during registration.' });
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized.' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organization: true,
          createdAt: true,
          _count: {
            select: {
              documents: true,
              generatedDocs: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
  }
}
