-- Part BO: the language choice needs a column to be saved in.
-- Saving the language on web and mobile failed with a 400 because user_settings has no "language" column.
-- Web stores a code (en, hi, te, ta); mobile stores the English name (English, Hindi, Telugu, Tamil), so this is plain text.
alter table public.user_settings add column if not exists language text default 'en';

-- the older version of this column (if it exists) was limited to 10 characters; lift that
alter table public.user_settings alter column language type text;
