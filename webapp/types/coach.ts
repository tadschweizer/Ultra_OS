/**
 * Coach Command Center — TypeScript types
 *
 * These types mirror the Supabase schema added in migration
 * 20260405000000_add_coach_command_center.sql.
 *
 * Convention: all `id` / FK fields are `string` (UUID).
 * Nullable DB columns are `string | null` (or the appropriate type | null).
 * Arrays default to `string[]` for text[] columns.
 */

// ---------------------------------------------------------------------------
// coach_profiles
// ---------------------------------------------------------------------------

export interface CoachProfile {
  /** UUID primary key (gen_random_uuid) */
  id: string;

  /**
   * FK → athletes.id — the coach's athlete profile.
   * Consistent with the rest of the application which uses athletes.id
   * rather than auth.users directly.
   */
  athlete_id: string;

  /** Public display name shown to athletes */
  display_name: string;

  /** Short code used in legacy invite links */
  coach_code: string;

  /** Optional bio / about section */
  bio: string | null;

  /** Sport specialties, e.g. ['ultrarunning', 'gravel', 'triathlon'] */
  specialties: string[] | null;

  /** Coaching certifications, e.g. ['USAT Level 1', 'USATF'] */
  certifications: string[] | null;

  /** URL to profile avatar image */
  avatar_url: string | null;

  /** Maximum number of athletes this coach can have simultaneously */
  max_athletes: number;

  /** Stripe customer ID for billing */
  stripe_customer_id: string | null;

  /** Subscription lifecycle status, e.g. 'active', 'inactive', 'past_due' */
  subscription_status: string;

  /** Stripe price tier identifier */
  subscription_tier: string;

  created_at: string;
  updated_at: string;
}

export type CoachProfileInsert = Omit<CoachProfile, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<CoachProfile, 'id' | 'created_at' | 'updated_at'>>;

export type CoachProfileUpdate = Partial<
  Omit<CoachProfile, 'id' | 'athlete_id' | 'created_at'>
>;

// ---------------------------------------------------------------------------
// coach_athlete_relationships
// ---------------------------------------------------------------------------

export type CoachAthleteRelationshipStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'removed';

export interface CoachAthleteRelationship {
  id: string;

  /** FK → coach_profiles.id */
  coach_id: string;

  /** FK → athletes.id */
  athlete_id: string;

  status: CoachAthleteRelationshipStatus;

  /** When the coach sent the invite */
  invited_at: string;

  /** When the athlete accepted (null until accepted) */
  accepted_at: string | null;

  /** When the relationship was ended (null while active) */
  removed_at: string | null;

  /** Optional label the coach assigns, e.g. 'Elite Squad', 'Marathon Group A' */
  group_name: string | null;

  /**
   * Private coach notes about this athlete.
   * Athletes never have read access to this field.
   */
  notes: string | null;

  created_at: string;
}

export type CoachAthleteRelationshipInsert = Omit<
  CoachAthleteRelationship,
  'id' | 'created_at'
> &
  Partial<Pick<CoachAthleteRelationship, 'id' | 'created_at'>>;

export type CoachAthleteRelationshipUpdate = Partial<
  Omit<CoachAthleteRelationship, 'id' | 'coach_id' | 'athlete_id' | 'created_at'>
>;

// ---------------------------------------------------------------------------
// coach_invitations
// ---------------------------------------------------------------------------

export type CoachInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

export interface CoachInvitation {
  id: string;

  /** FK → coach_profiles.id */
  coach_id: string;

  /** Email address the invite was sent to */
  email: string;

  /** Unique token embedded in the invite URL */
  token: string;

  status: CoachInvitationStatus;

  /** When the invite link stops working */
  expires_at: string;

  /** Set when the athlete accepts the invitation */
  accepted_at: string | null;

  created_at: string;
}

export type CoachInvitationInsert = Omit<CoachInvitation, 'id' | 'created_at'> &
  Partial<Pick<CoachInvitation, 'id' | 'created_at'>>;

export type CoachInvitationUpdate = Partial<
  Omit<CoachInvitation, 'id' | 'coach_id' | 'created_at'>
>;

// ---------------------------------------------------------------------------
// assigned_protocols
// ---------------------------------------------------------------------------

export type AssignedProtocolStatus =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

/**
 * Flexible JSON structure stored in `instructions`.
 * Steps are ordered; each has a label and optional detail fields.
 */
export interface ProtocolStep {
  order: number;
  label: string;
  duration_minutes?: number;
  intensity?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface ProtocolInstructions {
  steps?: ProtocolStep[];
  frequency?: string;
  warm_up?: string;
  cool_down?: string;
  equipment?: string[];
  [key: string]: unknown;
}

export interface AssignedProtocol {
  id: string;

  /** FK → coach_profiles.id */
  coach_id: string;

  /** FK → athletes.id */
  athlete_id: string;

  protocol_name: string;

  /**
   * Maps to intervention category taxonomy.
   * Examples: 'heat_acclimation', 'altitude', 'nutrition', 'sleep'
   */
  protocol_type: string;

  description: string | null;

  /** Structured training steps and schedule */
  instructions: ProtocolInstructions;

  /** Optional FK → races.id */
  target_race_id: string | null;

  /** ISO date string (YYYY-MM-DD) */
  start_date: string;

  /** ISO date string (YYYY-MM-DD) */
  end_date: string;

  status: AssignedProtocolStatus;

  /** Target adherence percentage (0–100) */
  compliance_target: number;

  created_at: string;
  updated_at: string;
}

export type AssignedProtocolInsert = Omit<AssignedProtocol, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<AssignedProtocol, 'id' | 'created_at' | 'updated_at'>>;

export type AssignedProtocolUpdate = Partial<
  Omit<AssignedProtocol, 'id' | 'coach_id' | 'athlete_id' | 'created_at'>
>;

// ---------------------------------------------------------------------------
// coach_notes
// ---------------------------------------------------------------------------

export type CoachNoteType =
  | 'observation'
  | 'flag'
  | 'reminder'
  | 'race_debrief';

export interface CoachNote {
  id: string;

  /** FK → coach_profiles.id */
  coach_id: string;

  /** FK → athletes.id */
  athlete_id: string;

  content: string;

  note_type: CoachNoteType;

  /** Optional FK → interventions.id */
  related_intervention_id: string | null;

  /** Optional FK → assigned_protocols.id */
  related_protocol_id: string | null;

  /** Pinned notes appear at the top of the athlete card */
  is_pinned: boolean;

  created_at: string;
}

export type CoachNoteInsert = Omit<CoachNote, 'id' | 'created_at'> &
  Partial<Pick<CoachNote, 'id' | 'created_at'>>;

export type CoachNoteUpdate = Partial<
  Omit<CoachNote, 'id' | 'coach_id' | 'athlete_id' | 'created_at'>
>;

// ---------------------------------------------------------------------------
// protocol_templates
// ---------------------------------------------------------------------------

export interface ProtocolTemplate {
  id: string;

  /** FK → coach_profiles.id — the coach who created this template */
  coach_id: string;

  name: string;

  /** Same taxonomy as AssignedProtocol.protocol_type */
  protocol_type: string;

  description: string | null;

  /** Canonical template instructions (same shape as AssignedProtocol.instructions) */
  instructions: ProtocolInstructions;

  /** Typical length when this template is instantiated */
  duration_weeks: number | null;

  /**
   * When true, all coaches on the platform can read (not edit) this template.
   * Used to build a shared template library.
   */
  is_shared: boolean;

  created_at: string;
}

export type ProtocolTemplateInsert = Omit<ProtocolTemplate, 'id' | 'created_at'> &
  Partial<Pick<ProtocolTemplate, 'id' | 'created_at'>>;

export type ProtocolTemplateUpdate = Partial<
  Omit<ProtocolTemplate, 'id' | 'coach_id' | 'created_at'>
>;

// ---------------------------------------------------------------------------
// get_coach_dashboard_summary() return type
// ---------------------------------------------------------------------------

export interface CoachDashboardSummary {
  /** Number of athletes in an 'active' relationship with this coach */
  total_athletes: number;

  /** Protocols in 'assigned' or 'in_progress' state */
  active_protocols: number;

  /**
   * Active athletes who have not logged any intervention in the past 7 days.
   * Surfaces who may need a check-in.
   */
  athletes_needing_attention: number;

  /** Races within the next 30 days for any actively coached athlete */
  upcoming_races: number;
}

// ---------------------------------------------------------------------------
// Convenience union / helper types
// ---------------------------------------------------------------------------

/** Athlete row as seen through a coach relationship (joined view) */
export interface CoachRosterEntry {
  relationship: CoachAthleteRelationship;
  /** Partial athlete record — augment as needed for the UI */
  athlete: {
    id: string;
    name: string | null;
    email: string | null;
    primary_sports: string[];
    target_race_id: string | null;
  };
}

/** Payload for sending a coach invitation */
export interface SendCoachInvitationPayload {
  email: string;
  /** How many hours until the invite expires (default: 72) */
  expires_in_hours?: number;
}

/** Payload for assigning a protocol from a template */
export interface AssignProtocolFromTemplatePayload {
  template_id: string;
  athlete_id: string;
  start_date: string;
  end_date: string;
  target_race_id?: string;
  compliance_target?: number;
  /** Override the template name for this specific assignment */
  protocol_name?: string;
}
