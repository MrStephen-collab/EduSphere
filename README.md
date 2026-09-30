# EduSphere

> **Your School. Your Digital Classroom.**

EduSphere is a production-ready, multi-tenant SaaS platform for Nigerian schools —
a **digital classroom + LMS + CBT + assessment + academic engagement** platform.
Each school gets its own isolated, branded digital academic environment.

## Features

- **Multi-tenant by design** — every school is fully isolated (RLS enforced at the database level).
- **Role-based access control** — `SUPER_ADMIN`, `SCHOOL_OWNER`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`, `STUDENT`, `PARENT`.
- **Digital learning** — courses → modules → lessons with videos, PDFs, notes and practice.
- **Assignments** — multimedia submissions, grading and teacher feedback.
- **Computer-based testing (CBT) engine** — question banks, randomization, timers, auto-marking, results and attempt history.
- **Essays & Paper-2 marking** — full-answer essay questions on any series; students type their working, teachers mark them manually against an answer guide, and the score rolls into the student's attempt after marking.
- **Exam series** — a catalogue of past-question practice series for **Common Entrance, WAEC, NECO and JAMB** (plus school-format papers), with instant auto-marking and answer reviews.
- **Results & analytics** — student, teacher, class and subject performance analytics.
- **Report cards & termly results** — printable per-term and cumulative annual report cards with grade bands, class positions and a class results sheet for teachers (computed live from graded assignments, CBT practice and daily attendance marks).
- **Parent portal** — a linked parent can view each child's results, assignments, course progress and printable report cards.
- **Fees & payments** — schools invoice per child, one-off or by whole class for a term. A parent pays the outstanding balance through Paystack; the webhook only *queues* the payment, and a bursar approves it from `/school/fees` before any money is credited. Bulk term billing is idempotent (a deterministic `billing_key`), approval clamps to the amount owed and is guarded against two bursars approving at once, and the school sees live invoiced / collected / outstanding / overdue totals. A parent can never mark themselves paid.
- **Global search** — Ctrl/Cmd+K command bar across the whole app: schools, classes, teachers, students, subjects, courses, lessons, assignments, exam series and announcements, with role-aware results.
- **Public school websites** — every school gets a branded public homepage at `/schools/[slug]` (about, academics, admissions, news, events, gallery, contact) rendered from real database data with its own theming.
- **Email notifications** — provider-agnostic transactional emails (Welcome, password reset, assignment created/graded, exam result, school announcements, subscription confirmation) with an exam-reminder template ready for a scheduler. Defaults to console logging until an API key is added.
- **Attendance** — teachers take a per-class daily register (present / late / absent / excused); report cards and the class results sheet aggregate days present plus attendance rate.
- **Subscriptions & payments** — DB-driven pricing plans (Starter / Professional / Premium) with a Paystack integration: schools start a checkout from `/school/billing`, pay on Paystack, and Paystack webhooks (`/api/webhooks/paystack`) instantly activate or switch the school's subscription. A super-admin plan manager (`/platform/subscriptions`) creates, edits and toggles plans and refunds payments. The marketing site reads plans live from the database — no hard-coded prices.
- **PWA-ready, mobile-first** UI with bottom navigation for students/teachers/parents on phones. Add-to-home-screen is enabled via a web app manifest, app icons, a network-first service worker (`/sw.js`) with a cached offline fallback page, and apple-touch metadata — regenerate `public/icons/*` anytime with `powershell scripts/generate-icons.ps1`.

> This is **Phase 1 (Foundation)** plus the first slices of the **Learning**
> module (courses, modules, lessons, materials, progress tracking), the
> **Assignments** module (set assignments, submit, grade with feedback), the
> **Exam Series + CBT** module (national/board exam practice with timed papers,
> sections, shuffle and **essay / full-answer questions with manual teacher
> marking** — teacher question authoring, student practice with auto-marking,
> answer reviews and a marking queue), the **Results / Report Cards** module
> (results and analytics pages plus printable termly and annual report cards),
> the **Attendance** module (teachers take a per-class daily register; report
> cards and the class sheet carry attendance today), the **Parent Portal**
> (linked parents see results, assignments, progress and report cards) and the
> **Subscriptions & payments** slice (DB-driven plans, Paystack checkout,
> webhook-driven activation, platform plan management and billing history).
> Authentication, RBAC, multi-tenancy, database schema, RLS policies, and the
> application shell are complete. Cross-cutting slices shipped since: global
> search, the public school website layer and transactional email notifications.

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Route Handlers)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com) (base-nova style, Base UI)
- [Lucide](https://lucide.dev) icons
- [Supabase](https://supabase.com) — PostgreSQL, Auth, Storage, RLS
- [Zod](https://zod.dev) — validation
- [Vitest](https://vitest.dev) — unit tests

## Architecture

```text
src/
├── app/
│   ├── (marketing)/          # Landing, about, contact, privacy
│   ├── auth/                 # Login, register, password reset
│   ├── platform/             # Super admin
│   ├── school/               # School admin / owner / principal
│   ├── teacher/
│   ├── student/
│   ├── parent/
│   └── ...
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── layout/               # App shell, sidebar, header, bottom nav
│   ├── dashboard/            # Stat cards, empty states
│   └── auth/
├── lib/
│   ├── supabase/             # client / server / admin clients
│   ├── auth/                 # session + auth context, server actions
│   ├── permissions/          # centralized RBAC
│   ├── validation/           # Zod schemas
│   └── ...
├── config/                   # site + navigation config
├── types/                    # database row types
└── middleware.ts (proxy)
supabase/
└── migrations/               # SQL schema + RLS policies + seed
```

Business logic lives in `lib/` and `services/`; UI components never query the
database directly.

## Multi-Tenancy & Security

- Every school-owned table carries a `school_id`.
- **Row Level Security** is enabled on every table; a helper function
  (`is_school_member`, `is_school_admin`, `is_super_admin`) powers the policies:
  teachers/students/admins can only ever read rows in their own school.
- A parent can only view rows for explicitly linked children.
- Authorization is **server-side first** — never trust client role checks.
- Sensitive operations feed the `audit_logs` table.
- Secrets are never committed; see `.env.example`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in Supabase credentials:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PLATFORM_NAME=EduSphere
PAYSTACK_SECRET_KEY=            # enables Paystack checkout + webhooks
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=

# Email notifications (optional — logs to console when left as below)
EMAIL_PROVIDER=log              # "resend" | "brevo" | "log"
EMAIL_FROM=EduSphere <noreply@edusphere.dev>
EMAIL_PROVIDER_API_KEY=         # leave empty to keep logging to the server console
```

With `EMAIL_PROVIDER` set to `resend` or `brevo` and the matching API key in
`EMAIL_PROVIDER_API_KEY`, transactional emails are delivered for real. Without
a key, every send is written to the server console (`[email:log] …`) so flows
are testable without an account.

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Setup (Supabase)

1. Create a Supabase project.
2. In **SQL Editor**, run the migration files in order:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_seed_structural.sql`
   - `supabase/migrations/0004_display_names.sql`
   - `supabase/migrations/0005_learning_policies.sql`
   - `supabase/migrations/0006_assignment_policies.sql`
   - `supabase/migrations/0007_exam_series.sql`
   - `supabase/migrations/0008_results_analytics.sql`
   - `supabase/migrations/0009_cbt_exams.sql`
   - `supabase/migrations/0010_parent_portal.sql`
   - `supabase/migrations/0011_essay_marking.sql`
   - `supabase/migrations/0012_attendance.sql`
   - `supabase/migrations/0013_parent_results_policies.sql`
   - `supabase/migrations/0014_course_materials.sql`
   - `supabase/migrations/0015_parent_complaints.sql`
   - `supabase/migrations/0016_parent_fee_payments.sql`
3. With `npm run dev` running, execute the demo-user seeder once:

```bash
node scripts/seed.mjs
```

This creates development-only demo accounts (password from
`DEMO_USER_PASSWORD` in `.env.local`):

```text
admin@greenfield.test     SCHOOL_ADMIN
teacher@greenfield.test   TEACHER
student@greenfield.test   STUDENT
parent@greenfield.test    PARENT
```

> Enable "Email Provider → Disable email confirmations" for local dev so the
> demo accounts can sign in immediately.

## Development Commands

```bash
npm run dev          # start dev server
npm run app          # production preview server (next start) on port 3100
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest (unit tests)
npm run build       # production build
```

The prod preview (`npm run app`) serves the optimized build on
`http://localhost:3100` — use it to verify a build before shipping. To view it
from a phone on the same Wi-Fi, visit `http://<your-lan-ip>:3100`.

### Database-backed verification

These four talk to the **real** database (or a running server) through genuine
RLS user sessions, so a failure means a real user would hit it. They are not
covered by `npm run test`.

```bash
npm run acceptance            # §87 critical acceptance test (needs a seed + server)
npm run smoke                 # renders every dashboard page per demo role (needs a server on :3100)
npm run verify:fee-rls        # fee invoice/payment isolation + approval gate
npm run verify:fee-statement  # statement + receipt figures against real data (needs a server)
npm run verify:complaint-rls  # complaint isolation + school reply
```

`acceptance` and `smoke` both need a running server; so does
`verify:fee-statement`, which seeds a known set of charges and payments and
reads the totals back off the rendered pages. `verify:fee-rls` and
`verify:complaint-rls` do not. Run
`node scripts/seed.mjs` once before `acceptance` to create the School A demo
data it walks through.

### Applying migrations

Migrations live in `supabase/migrations/` and are pushed with the Supabase CLI:

```bash
npx supabase db push --include-all
```

> The CLI cannot parse a `.env.local` containing a multi-line value (the
> `MUX_SIGNING_PRIVATE_KEY` PEM), so if it fails with
> `failed to parse environment file`, run it against a workdir that has
> `supabase/` but no `.env.local`:
> `--workdir <path>`.

## Route Map

```text
/                      Landing (marketing)
/auth/login            Sign in
/auth/register         Create school account

/schools/[slug]        Public (branded) school website

/platform              Super admin dashboard
/platform/subscriptions Super admin plan + payment management
/school                 School admin / owner / principal
/school/billing         School subscription + payment history
/school/fees            Issue invoices, bulk term billing, approve payments
/teacher                Teacher dashboard
/student                Student dashboard
/parent                 Parent dashboard
/pricing                Public pricing page (database-driven)

/api/webhooks/paystack          Paystack payment webhooks

/student/report-cards         Student report card (per term, printable)
/student/report-cards/annual  Student cumulative annual report card
/teacher/report-cards         Class termly results sheet (printable)
/teacher/attendance           Take / re-mark a class daily attendance register

/parent/children              All linked children
/parent/fees                  Child's invoices, balances, payment history
/parent/fees/statement        Printable statement of account, one child at a time
/parent/fees/receipt/[id]     Printable receipt for one approved payment
/parent/results               Results & analytics for one child
/parent/assignments           Child's assignments (read-only)
/parent/progress              Child's course progress
/parent/report-cards          Child report card (term/annual, printable)

/teacher/exam-series/[seriesId]/marking            Marking queue for a series
/teacher/exam-series/[seriesId]/marking/[attemptId] Mark one student's essay paper
```

## Role-Based Redirect

After login the app resolves `user → school → role → permissions` and redirects
to the correct dashboard. This logic lives in
`src/lib/auth/auth-context.ts` (`redirectToRoleHome`).

## Testing

- Unit tests cover the RBAC/permissions matrix, auth validation and the email
  templates (rendering + escaping):

```bash
npm run test
```

- The mandatory **tenant-isolation acceptance test** (School A cannot access
  School B) is specified in `EduSphere.txt` (section 87) and implemented in
  `scripts/acceptance.mjs`. It walks the full §87 journey on the seeded School A
  — course, module, published lesson, video + PDF, lesson completion, CBT
  attempt, auto-marked score, assignment submission, teacher grading, parent
  visibility — then creates a second school and proves it can reach none of it.
  **Currently 48 passed, 0 failed.**

  ```bash
  node scripts/seed.mjs   # once
  npm run acceptance
  ```

- Per-module RLS probes cover the two most sensitive areas (money and
  confidential complaints). Both currently pass in full — see
  `npm run verify:fee-rls` and `npm run verify:complaint-rls`.
- Parent statements and receipts are rendered from the same request-scoped
  client as the rest of the app, so they inherit the RLS policies rather than
  re-implementing them. A receipt exists only for an approved payment, since
  an approval is the only event that moves money; a statement for a child the
  parent is not linked to renders nothing rather than an empty balance.
- `fee_payments.credited_amount` records what an approval actually credited,
  which is not always what the parent tendered. Overpayment is clamped to the
  amount due and the difference is surfaced on the statement instead of being
  quietly absorbed. The column is constrained to `0 < credited <= amount` and
  to approved payments only, and backfills from the approval audit trail.

## Security Notes

- Never use the service-role key on the client.
- RLS is the final gate: all authorization checks must also happen server-side in
  server actions / route handlers.
- Files go into private Supabase Storage buckets and are served through
  authorized routes — never exposed publicly.

## Deployment

Standard Next.js deployment (e.g. Vercel). The `proxy` (middleware) refreshes
Supabase sessions on every request. Configure the Supabase project URL + keys in
the production environment.

---

Built for the pilot schools in Akure, Ondo State — and for the whole of Nigeria.