-- Run this SQL in the Supabase SQL Editor after reviewing the privacy notice.
create extension if not exists pgcrypto;

create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 10 and 13),
  email text,
  interest text not null check (interest in ('planos', 'dispositivos', 'catalogo', 'outro')),
  message text,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  privacy_notice_version text not null default 'draft-1',
  privacy_notice_acknowledged_at timestamptz not null default now(),
  event_id uuid not null unique,
  page_path text,
  campaign_source text,
  campaign_medium text,
  campaign_name text,
  campaign_content text,
  campaign_term text
);

alter table public.lead_submissions enable row level security;

-- No anonymous/authenticated policies are created on purpose.
-- Only the server, using SUPABASE_SERVICE_ROLE_KEY, may insert lead records.
-- Never expose the service-role key in frontend code or VITE_ environment variables.

create index if not exists lead_submissions_created_at_idx
  on public.lead_submissions (created_at desc);

create index if not exists lead_submissions_campaign_idx
  on public.lead_submissions (campaign_source, campaign_name);