-- =============================================================================
-- EduSphere — Bursar role
--
-- Running the fee desk is a separate job from running the school. A bursar
-- raises invoices, reviews payments and watches the collection rate, but does
-- not manage people, classes, settings or academic records. Until now the enum
-- had no way to say that, so schools had to hand a full admin account to the
-- person doing the books — or share the owner's login.
--
-- The change is additive: existing rows, policies and functions are untouched.
-- No policy needs to name the new value because the fee services read and write
-- with the service role after `requireFeeOfficer()` has checked the caller and
-- scoped them to their own school. Every other school table is readable by any
-- member (`is_school_member`), which a bursar is.
-- =============================================================================

alter type public.user_role add value if not exists 'BURSAR';
