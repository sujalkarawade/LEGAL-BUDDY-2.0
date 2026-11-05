import { Prisma } from '@prisma/client';
import prisma from '../../prisma/client.js';
import type { NearbySearchInput } from './constants.js';

const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_DEGREE_LAT = 111.32;

/** Great-circle distance in km (same formula as the SQL below; used by tests and the client). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Bounding box that fully contains the search circle. It lets PostgreSQL use the
 * (latitude, longitude) B-tree index before the exact Haversine distance is computed.
 */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const lngDelta = Math.min(radiusKm / (KM_PER_DEGREE_LAT * cosLat), 180);
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  };
}

/** Converts an experience band into a practiceStartYear range (inclusive). 10 years is in "6-10"; "10+" means 11 or more. */
export function experienceYearRange(band: NonNullable<NearbySearchInput['experience']>, currentYear = new Date().getFullYear()) {
  switch (band) {
    case '0-2': return { minStart: currentYear - 2, maxStart: currentYear };
    case '3-5': return { minStart: currentYear - 5, maxStart: currentYear - 3 };
    case '6-10': return { minStart: currentYear - 10, maxStart: currentYear - 6 };
    case '10+': return { minStart: 1900, maxStart: currentYear - 11 };
  }
}

export interface NearbyRow {
  id: string;
  distanceKm: number;
  totalCount: number;
}

/**
 * Lists publicly visible lawyers inside the radius. Portable PostgreSQL (no PostGIS needed):
 *   1. index-assisted bounding-box prefilter,
 *   2. exact Haversine distance,
 *   3. filters, ordering and pagination in one round trip (COUNT(*) OVER () for the total).
 * Only ids + distance are returned here; the caller loads the public projection.
 *
 * Visibility rule (also enforced in lawyer.controller for single profiles):
 *   Legal Buddy profiles must be VERIFIED; external directory listings (future) must be LISTED.
 */
export async function findNearbyLawyerIds(input: NearbySearchInput): Promise<NearbyRow[]> {
  const { lat, lng, radiusKm } = input;
  const box = boundingBox(lat, lng, radiusKm);

  const filters: Prisma.Sql[] = [
    Prisma.sql`o."isPrimary" = true`,
    Prisma.sql`o."latitude" BETWEEN ${box.minLat} AND ${box.maxLat}`,
    Prisma.sql`o."longitude" BETWEEN ${box.minLng} AND ${box.maxLng}`,
  ];

  if (input.verification === 'VERIFIED_ONLY') {
    filters.push(Prisma.sql`p."source" = 'LEGAL_BUDDY' AND p."status" = 'VERIFIED'`);
  } else {
    filters.push(Prisma.sql`((p."source" = 'LEGAL_BUDDY' AND p."status" = 'VERIFIED') OR (p."source" = 'EXTERNAL_DIRECTORY' AND p."status" = 'LISTED'))`);
  }

  if (input.specialization) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "lawyer_specializations" ls
      JOIN "specializations" s ON s."id" = ls."specializationId"
      WHERE ls."lawyerProfileId" = p."id" AND s."slug" = ${input.specialization} AND s."isActive" = true)`);
  }

  if (input.experience) {
    const range = experienceYearRange(input.experience);
    filters.push(Prisma.sql`p."practiceStartYear" BETWEEN ${range.minStart} AND ${range.maxStart}`);
  }

  if (input.mode === 'IN_PERSON') filters.push(Prisma.sql`p."offersInPerson" = true`);
  if (input.mode === 'ONLINE') filters.push(Prisma.sql`p."offersOnline" = true`);
  if (input.mode === 'BOTH') filters.push(Prisma.sql`p."offersInPerson" = true AND p."offersOnline" = true`);

  if (input.language) {
    filters.push(Prisma.sql`EXISTS (SELECT 1 FROM unnest(p."languages") AS lang WHERE lower(lang) = lower(${input.language}))`);
  }

  if (input.availability === 'ACCEPTING') filters.push(Prisma.sql`p."acceptingRequests" = true`);
  if (input.availability === 'UNAVAILABLE') filters.push(Prisma.sql`p."acceptingRequests" = false`);

  const orderBy = input.sort === 'EXPERIENCE'
    ? Prisma.sql`t."practiceStartYear" ASC NULLS LAST, t."distanceKm" ASC`
    : input.sort === 'RECENTLY_VERIFIED'
      ? Prisma.sql`t."verifiedAt" DESC NULLS LAST, t."distanceKm" ASC`
      : Prisma.sql`t."distanceKm" ASC, t."id" ASC`;

  const offset = (input.page - 1) * input.pageSize;

  return prisma.$queryRaw<NearbyRow[]>`
    SELECT t."id", t."distanceKm", (COUNT(*) OVER ())::int AS "totalCount"
    FROM (
      SELECT p."id", p."practiceStartYear", p."verifiedAt",
        (2 * ${EARTH_RADIUS_KM} * asin(least(1, sqrt(
          power(sin(radians(o."latitude" - ${lat}) / 2), 2) +
          cos(radians(${lat})) * cos(radians(o."latitude")) *
          power(sin(radians(o."longitude" - ${lng}) / 2), 2)
        )))) AS "distanceKm"
      FROM "lawyer_profiles" p
      JOIN "lawyer_offices" o ON o."lawyerProfileId" = p."id"
      WHERE ${Prisma.join(filters, ' AND ')}
    ) t
    WHERE t."distanceKm" <= ${radiusKm}
    ORDER BY ${orderBy}
    LIMIT ${input.pageSize} OFFSET ${offset}
  `;
}
