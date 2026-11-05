import { Prisma } from '@prisma/client';

/** Prisma include used everywhere a lawyer profile is rendered. Credentials are NEVER included here. */
export const lawyerPublicInclude = {
  offices: { where: { isPrimary: true }, take: 1 },
  specializations: { include: { specialization: true } },
  availability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
} satisfies Prisma.LawyerProfileInclude;

export type LawyerWithPublicRelations = Prisma.LawyerProfileGetPayload<{ include: typeof lawyerPublicInclude }>;

export function isPubliclyVisible(profile: { source: string; status: string }): boolean {
  return (profile.source === 'LEGAL_BUDDY' && profile.status === 'VERIFIED')
    || (profile.source === 'EXTERNAL_DIRECTORY' && profile.status === 'LISTED');
}

export function yearsOfExperience(practiceStartYear: number | null, currentYear = new Date().getFullYear()): number | null {
  if (!practiceStartYear) return null;
  return Math.max(0, currentYear - practiceStartYear);
}

/**
 * Public projection: the ONLY shape returned by search and public profile endpoints.
 * Omits userId, credentials, statusReason, verifiedById, internal flags and any contact
 * detail the lawyer has not explicitly chosen to publish.
 */
export function toPublicLawyer(profile: LawyerWithPublicRelations, distanceKm?: number | null) {
  const office = profile.offices[0] || null;
  const legalBuddyVerified = profile.source === 'LEGAL_BUDDY' && profile.status === 'VERIFIED';
  return {
    id: profile.id,
    professionalName: profile.professionalName,
    professionalTitle: profile.professionalTitle,
    bio: profile.bio,
    hasPhoto: Boolean(profile.photoStoredName),
    yearsOfExperience: yearsOfExperience(profile.practiceStartYear),
    practiceStartYear: profile.practiceStartYear,
    languages: profile.languages,
    education: profile.education,
    barCouncilState: profile.barCouncilState,
    enrollmentNumber: profile.enrollmentNumber,
    enrollmentDate: profile.enrollmentDate ? profile.enrollmentDate.toISOString().slice(0, 10) : null,
    source: profile.source,
    legalBuddyVerified,
    verifiedAt: legalBuddyVerified && profile.verifiedAt ? profile.verifiedAt.toISOString() : null,
    isSynthetic: profile.isSynthetic,
    specializations: profile.specializations
      .filter(s => s.specialization.isActive)
      .map(s => ({ id: s.specialization.id, slug: s.specialization.slug, name: s.specialization.name })),
    consultation: {
      offersInPerson: profile.offersInPerson,
      offersOnline: profile.offersOnline,
      acceptingRequests: profile.acceptingRequests,
      feeInr: profile.feeDisclosed ? profile.consultationFeeInr : null,
      availability: profile.availability.map(a => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime })),
    },
    contact: {
      phone: profile.publishPhone && profile.contactPhone ? profile.contactPhone : null,
      email: profile.publishEmail && profile.contactEmail ? profile.contactEmail : null,
    },
    office: office ? {
      officeName: office.officeName,
      addressLine: office.addressLine,
      locality: office.locality,
      city: office.city,
      state: office.state,
      postalCode: office.postalCode,
      latitude: office.latitude,
      longitude: office.longitude,
    } : null,
    distanceKm: typeof distanceKm === 'number' ? Math.round(distanceKm * 10) / 10 : null,
  };
}

export type PublicLawyer = ReturnType<typeof toPublicLawyer>;
