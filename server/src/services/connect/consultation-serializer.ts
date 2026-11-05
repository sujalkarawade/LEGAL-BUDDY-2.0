import { Prisma } from '@prisma/client';
import { canLawyerAccessSharedDocument, canLawyerReviewAnalysis } from './consultation-workflow.js';

export const consultationInclude = {
  specialization: { select: { id: true, name: true, slug: true } },
  sharedDocument: { select: { id: true, originalName: true } },
  lawyerProfile: {
    select: {
      id: true, professionalName: true, professionalTitle: true, status: true,
      contactPhone: true, publishPhone: true, contactEmail: true, publishEmail: true,
      offices: { where: { isPrimary: true }, take: 1, select: { city: true, state: true, addressLine: true, officeName: true } },
    },
  },
} satisfies Prisma.ConsultationRequestInclude;

export type ConsultationWithRelations = Prisma.ConsultationRequestGetPayload<{ include: typeof consultationInclude }>;

function base(r: ConsultationWithRelations) {
  return {
    id: r.id,
    status: r.status,
    mode: r.mode,
    specialization: r.specialization,
    preferredDate: r.preferredDate,
    preferredTime: r.preferredTime,
    proposedDate: r.proposedDate,
    proposedTime: r.proposedTime,
    scheduledDate: r.scheduledDate,
    scheduledTime: r.scheduledTime,
    rescheduleRequestedBy: r.rescheduleRequestedBy,
    lawyerMessage: r.lawyerMessage,
    userMessage: r.userMessage,
    cancelledBy: r.cancelledBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** What the requesting user sees: their own request plus the lawyer's PUBLISHED contact details only. */
export function toUserConsultation(r: ConsultationWithRelations) {
  const lp = r.lawyerProfile;
  const office = lp.offices[0];
  return {
    ...base(r),
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    description: r.description,
    lawyer: {
      id: lp.id,
      professionalName: lp.professionalName,
      professionalTitle: lp.professionalTitle,
      city: office?.city ?? null,
      state: office?.state ?? null,
      phone: lp.publishPhone ? lp.contactPhone : null,
      email: lp.publishEmail ? lp.contactEmail : null,
      isListed: lp.status === 'VERIFIED',
    },
    sharedDocument: r.sharedDocument && r.documentShareConsentAt
      ? {
        id: r.sharedDocument.id, originalName: r.sharedDocument.originalName, sharedAt: r.documentShareConsentAt.toISOString(),
        revokedAt: r.documentShareRevokedAt?.toISOString() ?? null, analysisShared: Boolean(r.analysisShareConsentAt),
      }
      : null,
  };
}

/** What the assigned lawyer sees. Shared document metadata appears only while consent is active. */
export function toLawyerConsultation(r: ConsultationWithRelations) {
  return {
    ...base(r),
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    description: r.description,
    sharedDocument: canLawyerAccessSharedDocument(r) && r.sharedDocument
      ? { originalName: r.sharedDocument.originalName, sharedAt: r.documentShareConsentAt!.toISOString(), analysisShared: canLawyerReviewAnalysis(r) }
      : null,
  };
}
