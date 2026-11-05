import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const ROLES = ['USER', 'LAWYER', 'ADMIN'] as const;
export type Role = typeof ROLES[number];

/**
 * Server-side role gate. Must run after authenticateToken, which reloads the user's role
 * from the database on every request, so a role change takes effect immediately and a
 * tampered JWT payload cannot grant a role.
 */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowed.includes(role as Role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}
