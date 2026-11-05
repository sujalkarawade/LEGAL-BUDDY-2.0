import type { ConsultationStatus } from './constants.js';

export type Actor = 'USER' | 'LAWYER';
export type UserAction = 'CONFIRM' | 'REQUEST_RESCHEDULE' | 'CANCEL';
export type LawyerAction = 'ACCEPT' | 'REJECT' | 'PROPOSE_TIME' | 'COMPLETE' | 'CANCEL';

export interface ConsultationState {
  status: ConsultationStatus;
  rescheduleRequestedBy: string | null;
  preferredDate: string;
  preferredTime: string;
  proposedDate: string | null;
  proposedTime: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
}

export interface TransitionInput {
  date?: string;
  time?: string;
  message?: string | null;
}

export interface TransitionResult {
  status: ConsultationStatus;
  updates: Partial<ConsultationState> & { cancelledBy?: string | null; lawyerMessage?: string | null; userMessage?: string | null };
  /** Who should be notified and with what event key. */
  notify: { recipient: Actor; event: string } | null;
}

export class WorkflowError extends Error {
  constructor(message: string, public readonly httpStatus = 409) { super(message); }
}

const OPEN_STATUSES: ConsultationStatus[] = ['PENDING', 'ACCEPTED', 'RESCHEDULE_REQUESTED', 'CONFIRMED'];

function requireSlot(input: TransitionInput, label: string): { date: string; time: string } {
  if (!input.date || !input.time) throw new WorkflowError(`${label} requires a date and time.`, 400);
  return { date: input.date, time: input.time };
}

/**
 * Pure consultation state machine (no database access) so every transition is unit-testable.
 *
 *  PENDING ──ACCEPT──▶ ACCEPTED ──CONFIRM(user)──▶ CONFIRMED ──COMPLETE──▶ COMPLETED
 *     │                   │                            │
 *     ├─REJECT──▶ REJECTED │                            │
 *     └─PROPOSE_TIME / REQUEST_RESCHEDULE ─▶ RESCHEDULE_REQUESTED (by LAWYER | USER)
 *  Any open state ──CANCEL──▶ CANCELLED
 */
export function applyTransition(state: ConsultationState, actor: Actor, action: UserAction | LawyerAction, input: TransitionInput = {}): TransitionResult {
  const s = state.status;
  const pendingFromUser = s === 'RESCHEDULE_REQUESTED' && state.rescheduleRequestedBy === 'USER';
  const pendingFromLawyer = s === 'RESCHEDULE_REQUESTED' && state.rescheduleRequestedBy === 'LAWYER';
  const invalid = () => new WorkflowError(`This request cannot be updated with "${action}" while it is ${s.replace(/_/g, ' ').toLowerCase()}.`);

  if (actor === 'LAWYER') {
    switch (action as LawyerAction) {
      case 'ACCEPT':
        if (!(s === 'PENDING' || pendingFromUser)) throw invalid();
        return {
          status: 'ACCEPTED',
          updates: { scheduledDate: state.preferredDate, scheduledTime: state.preferredTime, rescheduleRequestedBy: null, proposedDate: null, proposedTime: null, lawyerMessage: input.message ?? null },
          notify: { recipient: 'USER', event: 'CONSULTATION_ACCEPTED' },
        };
      case 'REJECT':
        if (!(s === 'PENDING' || pendingFromUser)) throw invalid();
        return { status: 'REJECTED', updates: { lawyerMessage: input.message ?? null, rescheduleRequestedBy: null }, notify: { recipient: 'USER', event: 'CONSULTATION_REJECTED' } };
      case 'PROPOSE_TIME': {
        if (!(s === 'PENDING' || s === 'ACCEPTED' || s === 'CONFIRMED' || pendingFromUser)) throw invalid();
        const slot = requireSlot(input, 'Proposing a new time');
        return {
          status: 'RESCHEDULE_REQUESTED',
          updates: { proposedDate: slot.date, proposedTime: slot.time, rescheduleRequestedBy: 'LAWYER', lawyerMessage: input.message ?? null },
          notify: { recipient: 'USER', event: 'CONSULTATION_TIME_PROPOSED' },
        };
      }
      case 'COMPLETE':
        if (s !== 'CONFIRMED') throw invalid();
        return { status: 'COMPLETED', updates: {}, notify: null };
      case 'CANCEL':
        if (!OPEN_STATUSES.includes(s) || s === 'PENDING') throw invalid(); // a pending request is rejected, not cancelled
        return { status: 'CANCELLED', updates: { cancelledBy: 'LAWYER', lawyerMessage: input.message ?? null }, notify: { recipient: 'USER', event: 'CONSULTATION_CANCELLED' } };
      default:
        throw new WorkflowError('Unknown action.', 400);
    }
  }

  switch (action as UserAction) {
    case 'CONFIRM':
      if (s === 'ACCEPTED') {
        return { status: 'CONFIRMED', updates: { userMessage: input.message ?? null }, notify: { recipient: 'LAWYER', event: 'CONSULTATION_CONFIRMED' } };
      }
      if (pendingFromLawyer && state.proposedDate && state.proposedTime) {
        return {
          status: 'CONFIRMED',
          updates: { scheduledDate: state.proposedDate, scheduledTime: state.proposedTime, rescheduleRequestedBy: null, userMessage: input.message ?? null },
          notify: { recipient: 'LAWYER', event: 'CONSULTATION_CONFIRMED' },
        };
      }
      throw invalid();
    case 'REQUEST_RESCHEDULE': {
      if (!(s === 'PENDING' || s === 'ACCEPTED' || s === 'CONFIRMED' || pendingFromLawyer)) throw invalid();
      const slot = requireSlot(input, 'Requesting a reschedule');
      return {
        status: s === 'PENDING' ? 'PENDING' : 'RESCHEDULE_REQUESTED',
        updates: {
          preferredDate: slot.date, preferredTime: slot.time,
          rescheduleRequestedBy: s === 'PENDING' ? null : 'USER',
          proposedDate: null, proposedTime: null, userMessage: input.message ?? null,
        },
        notify: { recipient: 'LAWYER', event: 'CONSULTATION_RESCHEDULE_REQUESTED' },
      };
    }
    case 'CANCEL':
      if (!OPEN_STATUSES.includes(s)) throw invalid();
      return { status: 'CANCELLED', updates: { cancelledBy: 'USER', userMessage: input.message ?? null }, notify: { recipient: 'LAWYER', event: 'CONSULTATION_CANCELLED' } };
    default:
      throw new WorkflowError('Unknown action.', 400);
  }
}

/** A shared document may be opened by the lawyer only while consent is active and the request is live. */
export function canLawyerAccessSharedDocument(request: {
  status: string; sharedDocumentId: string | null; documentShareConsentAt: Date | null; documentShareRevokedAt: Date | null;
}): boolean {
  return Boolean(
    request.sharedDocumentId && request.documentShareConsentAt && !request.documentShareRevokedAt
    && !['REJECTED', 'CANCELLED'].includes(request.status),
  );
}

/**
 * Clause findings may be reviewed by the lawyer only when the user ALSO gave the separate
 * "share analysis" consent, on top of the active document-sharing consent.
 */
export function canLawyerReviewAnalysis(request: {
  status: string; sharedDocumentId: string | null; documentShareConsentAt: Date | null; documentShareRevokedAt: Date | null; analysisShareConsentAt: Date | null;
}): boolean {
  return canLawyerAccessSharedDocument(request) && Boolean(request.analysisShareConsentAt);
}

export const NOTIFICATION_COPY: Record<string, { title: string; body: string }> = {
  CONSULTATION_REQUESTED: { title: 'New consultation request', body: 'A user has requested a consultation. Open the request to review it.' },
  CONSULTATION_ACCEPTED: { title: 'Consultation request accepted', body: 'The lawyer accepted your request. Please confirm the consultation.' },
  CONSULTATION_REJECTED: { title: 'Consultation request declined', body: 'The lawyer is unable to take your request. You can search for another lawyer.' },
  CONSULTATION_TIME_PROPOSED: { title: 'New time proposed', body: 'The lawyer proposed a different time for your consultation.' },
  CONSULTATION_CONFIRMED: { title: 'Consultation confirmed', body: 'The consultation has been confirmed.' },
  CONSULTATION_RESCHEDULE_REQUESTED: { title: 'Reschedule requested', body: 'The user asked to change the consultation time.' },
  CONSULTATION_CANCELLED: { title: 'Consultation cancelled', body: 'A consultation has been cancelled.' },
};

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Preferred/proposed dates must be today or later and within 180 days. */
export function isSchedulableDate(date: string, today = todayIsoDate()): boolean {
  if (date < today) return false;
  const max = new Date(`${today}T00:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 180);
  return date <= max.toISOString().slice(0, 10);
}
