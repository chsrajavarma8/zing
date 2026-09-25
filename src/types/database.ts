// Hand-maintained types mirroring supabase/migrations/*.sql. Not exhaustive for
// every column, but covers the shapes the app reads/writes. Widen with `Json`
// for anything jsonb where we don't need strict typing.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Event {
  id: string;
  slug: string;
  name: string;
  organizer_name: string;
  tagline: string | null;
  description: string | null;
  prize_pool_label: string;
  start_date: string | null;
  end_date: string | null;
  registration_open_at: string | null;
  registration_close_at: string | null;
  timezone: string;
  team_size_min: number;
  team_size_max: number;
  support_email: string;
  support_phone: string;
  support_website: string | null;
  community_base_count: number;
  branding: Json;
  problem_statement_mode: "self_identified" | "organizer_provided";
  problem_statement_text: string | null;
  allow_gender_field: boolean;
  gender_field_required: boolean;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  team_lock_at: string | null;
  whatsapp_group_url: string | null;
  whatsapp_group_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  event_id: string;
  team_name: string;
  reference_id: string;
  status: "pending" | "verified" | "disqualified";
  extra_fields: Json;
  submission_delegate_member_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  event_id: string;
  team_id: string;
  profile_id: string | null;
  role: "lead" | "member";
  reference_id: string;
  full_name: string;
  date_of_birth: string;
  education_level: "school" | "college";
  college: string;
  roll_number: string | null;
  class_grade: string | null;
  email: string;
  mobile: string;
  whatsapp: string;
  whatsapp_same_as_mobile: boolean;
  gender: string | null;
  extra_fields: Json;
  verification_status: "pending" | "verified";
  invited_at: string | null;
  verified_at: string | null;
  consent_accepted: boolean;
  privacy_policy_version_id: string | null;
  terms_version_id: string | null;
  communication_consent_essential: boolean;
  communication_consent_promotional: boolean;
  created_at: string;
  updated_at: string;
}

export interface Round {
  id: string;
  event_id: string;
  key: "minor" | "intermediate" | "major";
  name: string;
  description: string | null;
  deliverables: string | null;
  evaluation_criteria: string | null;
  evaluation_guidelines: string | null;
  categories: string | null;
  advancement_rules: string | null;
  order_index: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface Submission {
  id: string;
  team_id: string;
  round_id: string;
  drive_folder_url: string | null;
  document_link_url: string | null;
  document_storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  checklist: Json;
  public_access_self_confirmed: boolean;
  review_status: "pending_review" | "accepted" | "rejected";
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  updated_at: string;
}

export interface FinalScore {
  id: string;
  round_id: string;
  team_id: string;
  judge_id: string;
  score: number;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface JudgingCriterion {
  id: string;
  round_id: string;
  name: string;
  max_marks: number;
  weight: number;
  order_index: number;
}

export interface ScoreRow {
  id: string;
  round_id: string;
  team_id: string;
  criterion_id: string;
  judge_id: string;
  marks: number;
  comments: string | null;
}

export interface Notification {
  id: string;
  event_id: string;
  title: string;
  message: string;
  audience_type: "all" | "team_leads" | "team_members" | "selected_teams" | "individual" | "round_based";
  audience_filter: Json;
  priority: "low" | "normal" | "high" | "urgent";
  related_round_id: string | null;
  channels: string[];
  action_link: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  event_id: string;
  title: string;
  type: "rules" | "submission_instructions" | "presentation_guidelines" | "exhibit_request" | "organizer_published";
  storage_path: string | null;
  external_url: string | null;
  version: number;
  is_current: boolean;
  published_at: string | null;
}

export interface Announcement {
  id: string;
  event_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string | null;
}

export interface Faq {
  id: string;
  event_id: string;
  question: string;
  answer: string;
  order_index: number;
  published: boolean;
}

export type RequestType = "general" | "exhibition" | "presentation" | "registration_correction" | "technical_issue";
export type RequestStatus = "open" | "in_progress" | "awaiting_response" | "resolved" | "rejected";

export interface ExhibitDetails {
  project_title?: string;
  exhibit_description?: string;
  space_or_equipment_needs?: string;
  additional_notes?: string;
}

export interface RequestRow {
  id: string;
  reference_id: string;
  event_id: string;
  team_id: string;
  requester_profile_id: string;
  type: RequestType;
  subject: string;
  message: string;
  related_round_id: string | null;
  details: ExhibitDetails | Json;
  status: RequestStatus;
  created_at: string;
}

export interface LoginActivityRow {
  id: string;
  attempted_email: string;
  profile_id: string | null;
  role: "participant" | "team_lead" | "event_admin" | "reviewer" | "super_admin" | "unknown";
  outcome: "success" | "invalid_credentials" | "rate_limited";
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Row of the team_roster view (0043_security_integrity_fixes.sql): what a
// participant may see about their teammates. email is null unless the viewer
// is that member or the team lead.
export interface RosterMember {
  id: string;
  team_id: string;
  event_id: string;
  role: "lead" | "member";
  full_name: string;
  college: string;
  education_level: "school" | "college";
  reference_id: string;
  verification_status: "pending" | "verified";
  has_account: boolean;
  is_self: boolean;
  email: string | null;
  created_at: string;
}

export interface FeedbackRow {
  id: string;
  event_id: string;
  profile_id: string | null;
  team_id: string | null;
  rating: number | null;
  registration_experience_rating: number | null;
  portal_usability_rating: number | null;
  communication_rating: number | null;
  what_worked_well: string | null;
  what_could_improve: string | null;
  created_at: string;
}

// Generic fallback for the Supabase client generic param. We're not running
// `supabase gen types`, so this intentionally widens rather than blocking builds.
type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type LooseView = {
  Row: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, LooseView>;
    Functions: {
      verify_id_card: {
        Args: { token: string };
        Returns: { full_name: string; team_name: string; event_name: string; role: string; reference_id: string; valid: boolean }[];
      };
      event_registration_stats: {
        Args: { eid: string };
        Returns: {
          participant_count: number;
          team_count: number;
          community_base_count: number;
          displayed_community_count: number;
        }[];
      };
      transfer_team_lead: {
        Args: { p_team_id: string; p_new_lead_member_id: string };
        Returns: void;
      };
      lead_add_team_member: { Args: { p_team_id: string; p_member: Json }; Returns: string };
      lead_remove_team_member: { Args: { p_member_id: string }; Returns: string };
      publish_policy_version: {
        Args: { p_event_id: string; p_type: string; p_version: string; p_content: string };
        Returns: string;
      };
      rate_limit_hit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: { allowed: boolean; retry_after_seconds: number }[];
      };
      revoke_user_sessions: { Args: { p_user_id: string }; Returns: number };
      auth_user_id_by_email: { Args: { p_email: string }; Returns: string | null };
    };
  };
};
