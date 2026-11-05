-- PART DL - an empty account_type means Creator everywhere (auth/account finding AUTH-F-07).
-- Safe to run more than once.
--
-- The web and mobile apps treat a profile with no account_type as 'creator'. Many database functions (ratings, network,
-- profile availability / highlights, collaboration) use COALESCE(account_type, 'fan'), so such a profile saw creator screens
-- but was refused by the database. Rewriting every one of those large functions (they are defined again in several parts)
-- is risky, so this part fixes the data instead: no profile may have an empty account_type any more.
--   1. existing empty values become 'creator'
--   2. a trigger turns an empty value on insert / update into 'creator', so it cannot come back
-- Legacy 'talent' profiles are not touched: the database already treats 'talent' as "not a fan", like the apps.

UPDATE public.profiles SET account_type = 'creator' WHERE account_type IS NULL;

CREATE OR REPLACE FUNCTION public.default_profile_account_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.account_type IS NULL THEN
    NEW.account_type := 'creator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS default_profile_account_type ON public.profiles;
CREATE TRIGGER default_profile_account_type
  BEFORE INSERT OR UPDATE OF account_type ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.default_profile_account_type();
