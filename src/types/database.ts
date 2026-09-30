export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type School = {
  id: string;
  name: string;
  slug: string;
  motto: string | null;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
  status: SchoolStatus;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SchoolStatus = "active" | "pending" | "suspended" | "inactive";

export type UserRoleName =
  | "SUPER_ADMIN"
  | "SCHOOL_OWNER"
  | "SCHOOL_ADMIN"
  | "PRINCIPAL"
  | "TEACHER"
  | "STUDENT"
  | "PARENT";

export type SchoolBranding = {
  id: string;
  school_id: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  id: string;
  school_id: string | null;
  user_id: string;
  role: UserRoleName;
  created_at: string;
};

export type AcademicSession = {
  id: string;
  school_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type Term = {
  id: string;
  school_id: string;
  session_id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type SchoolClass = {
  id: string;
  school_id: string;
  name: string; // JSS 1, SS 2 etc.
  order: number;
  created_at: string;
  updated_at: string;
};

export type SchoolStream = {
  id: string;
  school_id: string;
  name: string; // A, B, C
  created_at: string;
  updated_at: string;
};

export type Subject = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  created_at: string;
  updated_at: string;
};

export type Student = {
  id: string;
  school_id: string;
  user_id: string | null;
  admission_number: string;
  class_id: string | null;
  stream_id: string | null;
  gender: "male" | "female" | null;
  date_of_birth: string | null;
  guardian_phone: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Teacher = {
  id: string;
  school_id: string;
  user_id: string | null;
  staff_id: string | null;
  title: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Parent = {
  id: string;
  school_id: string;
  user_id: string | null;
  relationship: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ParentStudentRelationship = {
  id: string;
  school_id: string;
  parent_id: string;
  student_id: string;
  relation: string | null;
  created_at: string;
};

export type ComplaintCategory =
  | "academics"
  | "fees"
  | "conduct"
  | "facilities"
  | "staff"
  | "transport"
  | "other";

export type ComplaintStatus = "open" | "in_progress" | "resolved";

export type Complaint = {
  id: string;
  school_id: string;
  raised_by: string;
  raised_by_name: string;
  raised_by_role: string;
  category: ComplaintCategory;
  subject: string;
  status: ComplaintStatus;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintMessage = {
  id: string;
  complaint_id: string;
  author_id: string;
  author_name: string;
  is_from_school: boolean;
  body: string;
  created_at: string;
};

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export type AttendanceRecord = {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SchoolSettings = {
  id: string;
  school_id: string;
  midterm_marking: boolean;
  continuous_assessment_weight: number;
  examination_weight: number;
  allow_student_registration: boolean;
  allow_parent_registration: boolean;
  require_email_verification: boolean;
  low_data_mode: boolean;
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SchoolBrandingRow = SchoolBranding & {
  school: Pick<School, "name" | "motto" | "logo_url" | "favicon_url" | "email" | "phone" | "address" | "city" | "state" | "website" | "description">;
};

export type AcademicSessionRow = AcademicSession & {
  terms: Term[];
};

export type ContentStatus = "draft" | "published" | "archived";

export type AssignmentStatus = "not_started" | "draft" | "submitted" | "late" | "graded";

export type Assignment = {
  id: string;
  school_id: string;
  course_id: string | null;
  lesson_id: string | null;
  class_id: string | null;
  subject_id: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  max_score: number;
  attachment_url: string | null;
  status: ContentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AssignmentSubmission = {
  id: string;
  school_id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string | null;
  attachment_url: string | null;
  status: AssignmentStatus;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  graded_by: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  school_id: string;
  subject_id: string | null;
  class_id: string | null;
  teacher_id: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CourseModule = {
  id: string;
  school_id: string;
  course_id: string;
  title: string;
  description: string | null;
  order: number;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  school_id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  content: string | null;
  video_url: string | null;
  status: ContentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LessonMaterial = {
  id: string;
  school_id: string;
  lesson_id: string;
  title: string;
  file_type: string | null;
  file_url: string | null;
  file_size: bigint | null;
  is_public: boolean;
  storage_path: string | null;
  mime_type: string | null;
  download_restricted: boolean;
  provider: string | null;
  provider_asset_id: string | null;
  provider_playback_id: string | null;
  duration_seconds: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type VideoAccessLog = {
  id: string;
  school_id: string;
  material_id: string | null;
  lesson_id: string | null;
  viewer_id: string;
  viewer_role: string;
  provider: string;
  asset_id: string | null;
  playback_id: string | null;
  token_subject: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type VideoResource = {
  id: string;
  school_id: string;
  lesson_id: string | null;
  provider: string;
  provider_video_id: string;
  title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_by: string | null;
  created_at: string;
};

export type LessonProgress = {
  id: string;
  school_id: string;
  student_id: string;
  lesson_id: string;
  started_at: string | null;
  completed_at: string | null;
  progress_percentage: number;
  last_position: number | null;
  created_at: string;
  updated_at: string;
};

export type StudentProgress = {
  id: string;
  school_id: string;
  student_id: string;
  course_id: string | null;
  overall_percentage: number | null;
  lessons_completed: number;
  assignments_completed: number;
  tests_completed: number;
  learning_streak: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExamSeriesType = "common_entrance" | "waec" | "neco" | "jamb" | "school";

export type ExamSeries = {
  id: string;
  school_id: string;
  exam_type: ExamSeriesType;
  title: string;
  year: string | null;
  description: string | null;
  subject_id: string | null;
  class_id: string | null;
  status: ContentStatus;
  duration_minutes: number | null;
  shuffle_questions: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExamSection = {
  id: string;
  school_id: string;
  series_id: string;
  title: string;
  instructions: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type QuestionBank = {
  id: string;
  school_id: string;
  exam_series_id: string | null;
  name: string;
  subject_id: string | null;
  class_id: string | null;
  description: string | null;
  status: ContentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type QuestionType = "multiple_choice" | "true_false" | "multiple_answer" | "essay";

export type QuestionDifficulty = "easy" | "medium" | "hard" | "mixed";

export type Question = {
  id: string;
  school_id: string;
  question_bank_id: string | null;
  subject_id: string | null;
  class_id: string | null;
  section_id: string | null;
  question_text: string;
  question_type: QuestionType;
  topic: string | null;
  difficulty: QuestionDifficulty;
  marks: number;
  explanation: string | null;
  answer_guide: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type QuestionOption = {
  id: string;
  school_id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  position: number;
  created_at: string;
};

export type AttemptStatus = "in_progress" | "submitted" | "timed_out" | "abandoned";

export type PracticeAttempt = {
  id: string;
  school_id: string;
  exam_series_id: string;
  student_id: string;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_marks: number | null;
  correct_count: number;
  wrong_count: number;
  duration_minutes: number | null;
  time_used_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type PracticeAnswer = {
  id: string;
  school_id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  answer_text: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  marked_by: string | null;
  marked_at: string | null;
  answered_at: string;
  created_at: string;
};

export type BillingInterval = "monthly" | "annual";

export type SubscriptionStatus =
  | "active"
  | "inactive"
  | "past_due"
  | "canceled"
  | "trialing";

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_interval: BillingInterval;
  student_limit: number | null;
  teacher_limit: number | null;
  feature_limits: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  school_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "canceled";

export type Payment = {
  id: string;
  school_id: string;
  subscription_id: string | null;
  provider: string;
  provider_reference: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementTarget =
  | "school"
  | "class"
  | "students"
  | "teachers"
  | "parents";

export type Announcement = {
  id: string;
  school_id: string;
  title: string;
  message: string;
  target_type: AnnouncementTarget;
  class_id: string | null;
  published_at: string;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationType =
  | "assignment_due"
  | "assignment_graded"
  | "exam_upcoming"
  | "exam_result"
  | "new_lesson"
  | "announcement"
  | "system";

export type Notification = {
  id: string;
  user_id: string;
  school_id: string | null;
  type: NotificationType;
  title: string;
  message: string | null;
  read_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      schools: {
        Row: School;
        Insert: Partial<School>;
        Update: Partial<School>;
      };
      school_branding: {
        Row: SchoolBranding;
        Insert: Partial<SchoolBranding>;
        Update: Partial<SchoolBranding>;
      };
      user_roles: {
        Row: UserRole;
        Insert: Partial<UserRole>;
        Update: Partial<UserRole>;
      };
      academic_sessions: {
        Row: AcademicSession;
        Insert: Partial<AcademicSession>;
        Update: Partial<AcademicSession>;
      };
      terms: {
        Row: Term;
        Insert: Partial<Term>;
        Update: Partial<Term>;
      };
      classes: {
        Row: SchoolClass;
        Insert: Partial<SchoolClass>;
        Update: Partial<SchoolClass>;
      };
      streams: {
        Row: SchoolStream;
        Insert: Partial<SchoolStream>;
        Update: Partial<SchoolStream>;
      };
      subjects: {
        Row: Subject;
        Insert: Partial<Subject>;
        Update: Partial<Subject>;
      };
      students: {
        Row: Student;
        Insert: Partial<Student>;
        Update: Partial<Student>;
      };
      teachers: {
        Row: Teacher;
        Insert: Partial<Teacher>;
        Update: Partial<Teacher>;
      };
      parents: {
        Row: Parent;
        Insert: Partial<Parent>;
        Update: Partial<Parent>;
      };
      parent_student_relationships: {
        Row: ParentStudentRelationship;
        Insert: Partial<ParentStudentRelationship>;
        Update: Partial<ParentStudentRelationship>;
      };
      complaints: {
        Row: Complaint;
        Insert: Partial<Complaint>;
        Update: Partial<Complaint>;
      };
      complaint_messages: {
        Row: ComplaintMessage;
        Insert: Partial<ComplaintMessage>;
        Update: Partial<ComplaintMessage>;
      };
      school_settings: {
        Row: SchoolSettings;
        Insert: Partial<SchoolSettings>;
        Update: Partial<SchoolSettings>;
      };
      content_categories: {
        Row: { id: string; school_id: string; name: string; created_at: string };
        Insert: Partial<{ id: string; school_id: string; name: string; created_at: string }>;
        Update: Partial<{ id: string; school_id: string; name: string; created_at: string }>;
      };
      courses: {
        Row: Course;
        Insert: Partial<Course>;
        Update: Partial<Course>;
      };
      course_modules: {
        Row: CourseModule;
        Insert: Partial<CourseModule>;
        Update: Partial<CourseModule>;
      };
      lessons: {
        Row: Lesson;
        Insert: Partial<Lesson>;
        Update: Partial<Lesson>;
      };
      lesson_materials: {
        Row: LessonMaterial;
        Insert: Partial<LessonMaterial>;
        Update: Partial<LessonMaterial>;
      };
      video_access_log: {
        Row: VideoAccessLog;
        Insert: Partial<VideoAccessLog>;
        Update: Partial<VideoAccessLog>;
      };
      video_resources: {
        Row: VideoResource;
        Insert: Partial<VideoResource>;
        Update: Partial<VideoResource>;
      };
      lesson_progress: {
        Row: LessonProgress;
        Insert: Partial<LessonProgress>;
        Update: Partial<LessonProgress>;
      };
      student_progress: {
        Row: StudentProgress;
        Insert: Partial<StudentProgress>;
        Update: Partial<StudentProgress>;
      };
      assignments: {
        Row: Assignment;
        Insert: Partial<Assignment>;
        Update: Partial<Assignment>;
      };
      assignment_submissions: {
        Row: AssignmentSubmission;
        Insert: Partial<AssignmentSubmission>;
        Update: Partial<AssignmentSubmission>;
      };
      exam_series: {
        Row: ExamSeries;
        Insert: Partial<ExamSeries>;
        Update: Partial<ExamSeries>;
      };
      exam_sections: {
        Row: ExamSection;
        Insert: Partial<ExamSection>;
        Update: Partial<ExamSection>;
      };
      question_banks: {
        Row: QuestionBank;
        Insert: Partial<QuestionBank>;
        Update: Partial<QuestionBank>;
      };
      questions: {
        Row: Question;
        Insert: Partial<Question>;
        Update: Partial<Question>;
      };
      question_options: {
        Row: QuestionOption;
        Insert: Partial<QuestionOption>;
        Update: Partial<QuestionOption>;
      };
      practice_attempts: {
        Row: PracticeAttempt;
        Insert: Partial<PracticeAttempt>;
        Update: Partial<PracticeAttempt>;
      };
      practice_answers: {
        Row: PracticeAnswer;
        Insert: Partial<PracticeAnswer>;
        Update: Partial<PracticeAnswer>;
      };
      subscription_plans: {
        Row: SubscriptionPlan;
        Insert: Partial<SubscriptionPlan>;
        Update: Partial<SubscriptionPlan>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Partial<Subscription>;
        Update: Partial<Subscription>;
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment>;
        Update: Partial<Payment>;
      };
      announcements: {
        Row: Announcement;
        Insert: Partial<Announcement>;
        Update: Partial<Announcement>;
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification>;
        Update: Partial<Notification>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};