-- Run this once in the Supabase SQL editor (project uvzwhhwzelaelfhfkvdb).
-- Lets each form choose whether respondents see everyone else's answers after
-- submitting (e.g. off for a newsletter signup, on for an RSVP-style form).
-- Defaults to true so existing forms keep their current behavior.

alter table nsh_forms add column if not exists show_responses boolean not null default true;
