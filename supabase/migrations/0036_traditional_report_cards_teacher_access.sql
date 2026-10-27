-- =============================================================================
-- EduSphere — Traditional report cards: subject-teacher read access
--
-- Migration 0035 let a teacher read a card only when `teacher_classes` linked
-- them to the class. Secondary schools are organised by subject: a subject
-- teacher never appears in `teacher_classes`, they appear in the timetable.
-- Without this policy a subject teacher could open the entry form (writes go
-- through the service role) but could not read the scores another teacher had
-- already saved, so every other subject looked blank.
--
-- The policy is deliberately SELECT-only. Writes still run through the
-- service role after src/services/traditional-report-cards.ts has checked the
-- caller and merged their own subjects into the saved card.
-- =============================================================================

drop policy if exists p_traditional_report_cards_select_teacher
  on public.traditional_report_cards;

create policy "p_traditional_report_cards_select_teacher"
  on public.traditional_report_cards for select
  using (
    exists (
      select 1
      from public.teacher_classes tc
      join public.teachers t on t.id = tc.teacher_id
      where t.user_id = auth.uid()
        and tc.class_id = traditional_report_cards.class_id
        and tc.school_id = traditional_report_cards.school_id
    )
    or exists (
      select 1
      from public.timetable_entries te
      join public.teachers t on t.id = te.teacher_id
      where t.user_id = auth.uid()
        and te.class_id = traditional_report_cards.class_id
        and te.school_id = traditional_report_cards.school_id
    )
  );
