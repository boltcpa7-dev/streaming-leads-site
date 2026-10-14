-- Execute in Supabase SQL Editor after reviewing the privacy notice.
create extension if not exists pgcrypto;

-- One record per authorized campaign partner/operator.
-- Pixel IDs are browser identifiers, not secrets. Never store Meta access tokens here.
create table if not exists public.campaign_partners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  public_name text,
  meta_pixel_id text,
  active boolean not null default true
);

-- Each submitted lead belongs to the partner/campaign that generated the link.
create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  partner_id uuid not null references public.campaign_partners(id),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 10 and 13),
  email text,
  interest text not null default 'outro' check (interest in ('planos', 'dispositivos', 'catalogo', 'outro')),
  message text,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  privacy_notice_version text not null default 'draft-2',
  privacy_notice_acknowledged_at timestamptz not null default now(),
  event_id uuid not null unique,
  page_path text,
  campaign_source text,
  campaign_medium text,
  campaign_name text,
  campaign_content text,
  campaign_term text
);

-- Safe migration when upgrading from the first scaffold schema.
alter table public.lead_submissions
  add column if not exists partner_id uuid references public.campaign_partners(id);

alter table public.lead_submissions
  alter column interest set default 'outro';

alter table public.lead_submissions
  alter column interest drop not null;

alter table public.lead_submissions enable row level security;
alter table public.campaign_partners enable row level security;

-- Intentionally no anonymous/authenticated table policies are created.
-- The Express backend uses SUPABASE_SERVICE_ROLE_KEY. Keep that key server-side only.
-- This first version does not provide partner logins/dashboard; the site operator adds
-- partner records manually and accesses collected leads via controlled administration.

create index if not exists lead_submissions_created_at_idx
  on public.lead_submissions (created_at desc);

create index if not exists lead_submissions_partner_created_idx
  on public.lead_submissions (partner_id, created_at desc);

create index if not exists lead_submissions_campaign_idx
  on public.lead_submissions (campaign_source, campaign_name);

-- Example: create one campaign partner per person/advertising account.
-- insert into public.campaign_partners (slug, public_name, meta_pixel_id, active)
-- values ('parceiro-exemplo', null, '123456789012345', true);
--
-- The person's link is then:
-- https://SEU-DOMINIO/?p=parceiro-exemplo
--
-- When an authorized Meta Pixel is set, the browser loads it only after the visitor
-- accepts marketing cookies. Never use a raw pixel ID supplied directly in the URL.