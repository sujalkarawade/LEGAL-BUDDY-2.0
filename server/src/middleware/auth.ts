import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/index.js';
import prisma from '../prisma/client.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. No authorization token provided.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User account no longer exists or session has expired.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireDocumentOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const documentId = req.params.id || req.params.documentId;
    const userId = req.user?.id;

    if (!documentId) {
      res.status(400).json({ error: 'Document ID parameter is missing.' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'User authentication required.' });
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, userId: true },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    if (document.userId !== userId) {
      res.status(403).json({ error: 'Access denied. You do not have permission to view or modify this document.' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization verification failed.' });
  }
};
