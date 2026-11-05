-- Script Reader was removed from the project space. It had no tables of its own: it listed every PDF in public.files.
-- The PDFs it showed are ordinary project files, so they are still visible in the Files tab. Nothing needs to change.
--
-- OPTIONAL clean-up. A script cannot be told apart from any other PDF (call sheets, contracts, ...), so run step 1 first,
-- read the list, and delete only the rows that really are scripts (step 2, by id).

-- 1. Preview: every PDF in a project's files, newest first
select id, project_id, name, size, created_at
from public.files
where lower(name) like '%.pdf'
order by created_at desc;

-- 2. Delete chosen rows only (replace the ids). The stored file stays in the project-files bucket; remove it there too if wanted.
-- delete from public.files where id in ('<id-1>', '<id-2>');
