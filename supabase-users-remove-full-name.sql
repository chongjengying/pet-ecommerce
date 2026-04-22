-- Remove public.users.full_name after preserving names into first_name/last_name.
-- Safe to run multiple times.

alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists last_name text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'full_name'
  ) then
    update public.users
    set first_name = coalesce(
          nullif(first_name, ''),
          nullif(split_part(trim(full_name), ' ', 1), '')
        ),
        last_name = coalesce(
          nullif(last_name, ''),
          nullif(
            trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1)),
            ''
          )
        )
    where full_name is not null
      and trim(full_name) <> '';

    alter table public.users drop column if exists full_name;
  end if;
end $$;
