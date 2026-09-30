-- ---------------------------------------------------------------------------
-- Let a student read their own fee invoices.
--
-- Fees were parent-only by construction: 0016 gave SELECT on fee_invoices to a
-- school admin or the parent of the student named on the invoice, and nothing
-- to the student themselves. That left a secondary-school student unable to
-- answer "what do I owe, and can I show my parent the receipt?" -- the answer
-- was only available through someone else's login.
--
-- This adds the student branch, read-only, scoped to their own record. It
-- deliberately does not grant INSERT or UPDATE: a student must not be able to
-- mark their own invoice paid, which is the whole reason 0016 kept writes with
-- the school alone.
-- ---------------------------------------------------------------------------

-- Whether the caller is the student named by p_student_id. Resolved through
-- the students table rather than user_roles because a user can hold the STUDENT
-- role without being *this* student; a fee row is about one person.
create or replace function public.is_self_student(p_student_id uuid, p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.school_id = p_school_id
      and s.user_id = auth.uid()
  );
$$;

-- can_access_fee_invoice gates fee_payments, so it needs the same student
-- branch. Rewritten rather than added to: the policy already depends on it, and
-- a second helper would mean two places to keep in step.
create or replace function public.can_access_fee_invoice(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fee_invoices i
    where i.id = p_invoice_id
      and (
        public.is_super_admin()
        or public.is_school_admin(i.school_id)
        or public.is_parent_of_student(i.student_id, i.school_id)
        or public.is_self_student(i.student_id, i.school_id)
      )
  );
$$;

drop policy if exists p_fee_invoices_select_allowed on public.fee_invoices;
create policy "p_fee_invoices_select_allowed"
  on public.fee_invoices for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_parent_of_student(student_id, school_id)
    or public.is_self_student(student_id, school_id)
  );

-- Read-only, like the parent. The insert and update policies stay exactly as
-- 0016 wrote them; nothing here opens a write path for a student.
