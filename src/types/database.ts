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
  college: string;
  roll_number: string;
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
  advancement_rules: string | null;
  order_index: number;
  starts_at: string | null;
  ends_at: string | null;
  status: "upcoming" | "active" | "completed";
}

export interface Exam {
  id: string;
  round_id: string;
  title: string;
  instructions: string | null;
  duration_minutes: number;
  starts_at: string;
  ends_at: string;
  shuffle_questions: boolean;
  qualification_rule: Json;
  answer_key_release_at: string | null;
  status: "draft" | "scheduled" | "live" | "closed";
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: "mcq_single" | "mcq_multi" | "short_text";
  options: Json;
  correct_answer: Json | null;
  marks: number;
  order_index: number;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  team_member_id: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted" | "auto_submitted" | "disqualified";
  score: number | null;
}

export interface Submission {
  id: string;
  team_id: string;
  round_id: string;
  drive_folder_url: string | null;
  checklist: Json;
  public_access_self_confirmed: boolean;
  review_status: "pending" | "accessible" | "access_issue" | "accepted";
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
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
      is_login_eligible: { Args: { p_email: string }; Returns: boolean };
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
    };
  };
};
