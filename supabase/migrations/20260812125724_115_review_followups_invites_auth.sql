-- 115: historical no-op retained for remote migration version parity.
-- Original invite auth/capacity DDL already ships in 114; this file must stay
-- empty of schema changes so lexicographic order (before 112–114) is harmless.
SELECT 1;
