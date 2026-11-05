import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { credentialUpload, photoUpload } from '../middleware/connect-upload.js';
import { LawyerController } from '../controllers/lawyer.controller.js';
import { LawyerPortalController } from '../controllers/lawyer-portal.controller.js';
import { ConsultationController } from '../controllers/consultation.controller.js';
import { AdminLawyerController } from '../controllers/admin-lawyer.controller.js';
import { NotificationController, GeoController } from '../controllers/notification.controller.js';
import { ClauseReviewController } from '../controllers/clause-review.controller.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// ─── /api/lawyers — discovery (any signed-in role) ─────────────────────────
export const lawyerRoutes = Router();
// Photo is intentionally public so <img> tags work; it only serves publicly listed profiles.
lawyerRoutes.get('/:id/photo', LawyerController.getPublicPhoto);
lawyerRoutes.use(authenticateToken);
lawyerRoutes.get('/specializations', LawyerController.getSpecializations);
lawyerRoutes.get('/nearby', rateLimit({ name: 'nearby', windowMs: MINUTE, max: 60 }), LawyerController.searchNearby);
lawyerRoutes.get('/:id', LawyerController.getProfile);
lawyerRoutes.post('/:id/report', requireRole('USER'), rateLimit({ name: 'report', windowMs: HOUR, max: 5 }), LawyerController.reportProfile);

// ─── /api/lawyer-portal — the signed-in lawyer's own profile ───────────────
export const lawyerPortalRoutes = Router();
lawyerPortalRoutes.use(authenticateToken, requireRole('LAWYER'));
lawyerPortalRoutes.get('/profile', LawyerPortalController.getProfile);
lawyerPortalRoutes.put('/profile', LawyerPortalController.updateProfile);
lawyerPortalRoutes.put('/office', LawyerPortalController.updateOffice);
lawyerPortalRoutes.put('/availability', LawyerPortalController.updateAvailability);
lawyerPortalRoutes.post('/photo', rateLimit({ name: 'photo', windowMs: HOUR, max: 20 }), photoUpload, LawyerPortalController.uploadPhoto);
lawyerPortalRoutes.get('/photo', LawyerPortalController.getPhoto);
lawyerPortalRoutes.post('/credentials', rateLimit({ name: 'credential', windowMs: HOUR, max: 30 }), credentialUpload, LawyerPortalController.uploadCredential);
lawyerPortalRoutes.get('/credentials/:credentialId', LawyerPortalController.downloadCredential);
lawyerPortalRoutes.delete('/credentials/:credentialId', LawyerPortalController.deleteCredential);
lawyerPortalRoutes.post('/submit', rateLimit({ name: 'submit', windowMs: HOUR, max: 10 }), LawyerPortalController.submitForReview);
lawyerPortalRoutes.get('/consultations', LawyerPortalController.listConsultations);
lawyerPortalRoutes.patch('/consultations/:id', LawyerPortalController.actOnConsultation);
lawyerPortalRoutes.get('/consultations/:id/document', LawyerPortalController.getSharedDocument);
lawyerPortalRoutes.get('/consultations/:id/review', ClauseReviewController.lawyerGet);
lawyerPortalRoutes.post('/consultations/:id/review', rateLimit({ name: 'review-lawyer', windowMs: MINUTE, max: 30 }), ClauseReviewController.lawyerComment);

// ─── /api/consultations — the requesting user's side ───────────────────────
export const consultationRoutes = Router();
consultationRoutes.use(authenticateToken, requireRole('USER'));
consultationRoutes.post('/', rateLimit({ name: 'consultation-create', windowMs: HOUR, max: 10 }), ConsultationController.create);
consultationRoutes.get('/', ConsultationController.listMine);
consultationRoutes.get('/:id', ConsultationController.getMine);
consultationRoutes.patch('/:id', rateLimit({ name: 'consultation-update', windowMs: MINUTE, max: 30 }), ConsultationController.act);
consultationRoutes.get('/:id/review', ClauseReviewController.userGet);
consultationRoutes.post('/:id/review', rateLimit({ name: 'review-user', windowMs: MINUTE, max: 30 }), ClauseReviewController.userComment);

// ─── /api/admin/connect — verification & moderation (ADMIN only) ───────────
export const adminConnectRoutes = Router();
adminConnectRoutes.use(authenticateToken, requireRole('ADMIN'));
adminConnectRoutes.get('/stats', AdminLawyerController.stats);
adminConnectRoutes.get('/lawyers', AdminLawyerController.list);
adminConnectRoutes.get('/lawyers/:id', AdminLawyerController.detail);
adminConnectRoutes.get('/lawyers/:id/photo', AdminLawyerController.photo);
adminConnectRoutes.get('/lawyers/:id/credentials/:credentialId', AdminLawyerController.downloadCredential);
adminConnectRoutes.post('/lawyers/:id/decision', AdminLawyerController.decide);
adminConnectRoutes.get('/reports', AdminLawyerController.listReports);
adminConnectRoutes.patch('/reports/:reportId', AdminLawyerController.resolveReport);
adminConnectRoutes.get('/specializations', AdminLawyerController.listSpecializations);
adminConnectRoutes.post('/specializations', AdminLawyerController.createSpecialization);
adminConnectRoutes.patch('/specializations/:specId', AdminLawyerController.updateSpecialization);

// ─── /api/notifications and /api/geo ──────────────────────────────────────
export const notificationRoutes = Router();
notificationRoutes.use(authenticateToken);
notificationRoutes.get('/', NotificationController.list);
notificationRoutes.post('/read-all', NotificationController.markAllRead);
notificationRoutes.patch('/:id/read', NotificationController.markRead);

export const geoRoutes = Router();
geoRoutes.use(authenticateToken);
geoRoutes.get('/status', GeoController.status);
geoRoutes.get('/search', rateLimit({ name: 'geocode', windowMs: MINUTE, max: 15 }), GeoController.search);
