-- Yakap Bear: optional cloud schema with Row Level Security.
-- Apply in the Supabase SQL editor or with `supabase db push`.
-- The mobile app only ever uses the public anon key. Never ship the service-role key.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles and care recipients
-- ---------------------------------------------------------------------------
create table public.caregiver_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  phone text,
  app_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.care_recipients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.caregiver_profiles (id) on delete cascade,
  preferred_name text not null,
  relationship text not null,
  time_zone text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Care-circle permissions. Viewers can read; editors can also log doses.
create table public.care_circle_members (
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  consented_at timestamptz not null default now(),
  primary key (care_recipient_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Care plan
-- ---------------------------------------------------------------------------
create table public.medications (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  name text not null,
  dose_label text not null,
  instructions text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz
);

create table public.voice_recordings (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  name text not null,
  file_name text not null,
  duration_ms integer not null check (duration_ms between 0 and 30500),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.dose_schedules (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  time_of_day time not null,
  repeat_days smallint[] not null,
  start_date date not null,
  end_date date,
  active_from timestamptz not null,
  voice_recording_id uuid references public.voice_recordings (id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Append-only: corrections insert a new row, so the audit trail cannot be rewritten.
create table public.dose_events (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  occurrence_key text not null,
  schedule_id uuid not null,
  medication_id uuid not null,
  medication_name text not null,
  dose_label text not null,
  dose_date date not null,
  time_of_day time not null,
  event_type text not null check (event_type in ('taken', 'skipped', 'unconfirmed')),
  taken_at timestamptz,
  recorded_at timestamptz not null,
  recorded_by text not null,
  source text not null check (source in ('caregiver', 'demo_paw', 'correction', 'sample')),
  reason text,
  corrects_event_id uuid references public.dose_events (id)
);
create index dose_events_recipient_date_idx on public.dose_events (care_recipient_id, dose_date);

create table public.family_contacts (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  notify_missed_dose boolean not null default true,
  notify_bear_issues boolean not null default false,
  consent_confirmed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.bear_devices (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  serial text not null,
  mode text not null check (mode in ('demo', 'hardware')),
  paired_at timestamptz not null,
  last_battery integer
);

create table public.referrals (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  code text not null,
  status text not null check (status in ('demo', 'verified')),
  clinic_name text not null,
  clinician_name text,
  linked_at timestamptz not null
);

create table public.consents (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  kind text not null,
  status text not null check (status in ('active', 'revoked')),
  clinic_name text not null,
  scopes text[] not null,
  signed_by text not null,
  signature_path text not null,
  granted_at timestamptz not null,
  revoked_at timestamptz
);

create table public.care_activity (
  id uuid primary key,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  kind text not null,
  message text not null,
  at timestamptz not null
);

-- Clinic codes are managed by administrators and are never readable by app users.
create table public.clinic_referral_codes (
  code text primary key,
  clinic_name text not null,
  clinician_name text,
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_care_owner(recipient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.care_recipients r where r.id = recipient and r.owner_id = auth.uid());
$$;

create or replace function public.can_view_care(recipient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_care_owner(recipient) or exists (
    select 1 from public.care_circle_members m where m.care_recipient_id = recipient and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_log_care(recipient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_care_owner(recipient) or exists (
    select 1 from public.care_circle_members m
    where m.care_recipient_id = recipient and m.user_id = auth.uid() and m.role = 'editor'
  );
$$;

-- Validates one code at a time without exposing the list of codes.
create or replace function public.validate_referral_code(input_code text)
returns table (clinic_name text, clinician_name text)
language sql stable security definer set search_path = public as $$
  select c.clinic_name, c.clinician_name
  from public.clinic_referral_codes c
  where c.code = upper(trim(input_code)) and c.active and auth.uid() is not null;
$$;

revoke all on function public.validate_referral_code(text) from public, anon;
grant execute on function public.validate_referral_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.caregiver_profiles enable row level security;
alter table public.care_recipients enable row level security;
alter table public.care_circle_members enable row level security;
alter table public.medications enable row level security;
alter table public.voice_recordings enable row level security;
alter table public.dose_schedules enable row level security;
alter table public.dose_events enable row level security;
alter table public.family_contacts enable row level security;
alter table public.bear_devices enable row level security;
alter table public.referrals enable row level security;
alter table public.consents enable row level security;
alter table public.care_activity enable row level security;
alter table public.clinic_referral_codes enable row level security;
-- clinic_referral_codes intentionally has no policies, so clients cannot read it.

create policy "Profiles are private" on public.caregiver_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "Owners manage recipients" on public.care_recipients
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Care circle reads recipients" on public.care_recipients
  for select using (public.can_view_care(id));

create policy "Owners manage the care circle" on public.care_circle_members
  for all using (public.is_care_owner(care_recipient_id)) with check (public.is_care_owner(care_recipient_id));
create policy "Members see their membership" on public.care_circle_members
  for select using (user_id = auth.uid());

-- Owners manage the plan. The care circle can read it.
do $$
declare
  target text;
begin
  foreach target in array array[
    'medications', 'voice_recordings', 'dose_schedules', 'family_contacts',
    'bear_devices', 'referrals', 'consents'
  ] loop
    execute format(
      'create policy "Owners manage %1$s" on public.%1$I for all
         using (public.is_care_owner(care_recipient_id))
         with check (public.is_care_owner(care_recipient_id))', target);
    execute format(
      'create policy "Care circle reads %1$s" on public.%1$I for select
         using (public.can_view_care(care_recipient_id))', target);
  end loop;
end $$;

-- Dose events can be read and added, but never edited or deleted by clients.
create policy "Care circle reads dose events" on public.dose_events
  for select using (public.can_view_care(care_recipient_id));
create policy "Editors add dose events" on public.dose_events
  for insert with check (public.can_log_care(care_recipient_id));

create policy "Care circle reads activity" on public.care_activity
  for select using (public.can_view_care(care_recipient_id));
create policy "Editors add activity" on public.care_activity
  for insert with check (public.can_log_care(care_recipient_id));

-- ---------------------------------------------------------------------------
-- Private voice storage: files live at <care_recipient_id>/<file name>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('voice-recordings', 'voice-recordings', false)
on conflict (id) do update set public = false;

create policy "Care circle plays voice files" on storage.objects
  for select to authenticated using (
    bucket_id = 'voice-recordings'
    and public.can_view_care(((storage.foldername(name))[1])::uuid)
  );
create policy "Owners upload voice files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'voice-recordings'
    and public.is_care_owner(((storage.foldername(name))[1])::uuid)
  );
create policy "Owners delete voice files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'voice-recordings'
    and public.is_care_owner(((storage.foldername(name))[1])::uuid)
  );
