-- 119: Pin search_path on remaining public helpers flagged by the security advisor
-- (lint 0011 function_search_path_mutable).
-- These SQL helpers already qualify objects as public.*; pinning search_path
-- prevents a caller from injecting a malicious schema ahead of public.
--
-- HaveIBeenPwned leaked-password protection is Auth dashboard config (Pro+),
-- not SQL. The jugaMUS org is on the Free plan, so it cannot be enabled here.

ALTER FUNCTION public.tournament_pair_is_complete(uuid, text, uuid, text)
  SET search_path = public;

ALTER FUNCTION public.tournament_match_title(text, integer, boolean)
  SET search_path = public;

ALTER FUNCTION public.tournament_round_name(integer)
  SET search_path = public;

ALTER FUNCTION public.user_is_in_tournament_pair(uuid, uuid, uuid)
  SET search_path = public;
