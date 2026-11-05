import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';

/**
 * UX-only route guard. It hides pages a role cannot use; the real authorization is enforced by
 * requireRole() on every server endpoint, so bypassing this component exposes nothing.
 */
export const RequireRole: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
