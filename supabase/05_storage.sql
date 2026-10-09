-- ============================================================
-- HabitVerse · 05 — Storage: бакет для аватаров + политики
-- Выполните ПОСЛЕ 01…04 в SQL Editor.
--
-- Эквивалент в UI: Storage → New bucket → name "avatars" → Public
-- ============================================================

-- 1. Бакет (создаётся из SQL, чтобы не зависеть от порядка кликов)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,                                   -- 5 МБ
  array['image/png','image/jpeg','image/webp','image/gif','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Удаляем старые политики, если скрипт запускается повторно
drop policy if exists "avatars: чтение публичное"     on storage.objects;
drop policy if exists "avatars: загрузка своего файла" on storage.objects;
drop policy if exists "avatars: обновление своего"     on storage.objects;
drop policy if exists "avatars: удаление своего"       on storage.objects;

-- 3. Чтение: аватары публичные (их видно в ленте и лидерборде)
create policy "avatars: чтение публичное"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'avatars');

-- 4. Загрузка: только в свою папку  avatars/<user_id>.<ext>
create policy "avatars: загрузка своего файла"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and octet_length(content) <= 5242880
  );

-- 5. Замена аватара (upload с upsert:true)
create policy "avatars: обновление своего"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Удаление своего файла
create policy "avatars: удаление своего"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- ПРОВЕРКА: должно вернуть 4 строки
-- ============================================================
-- select policyname, cmd from pg_policies where tablename = 'objects' and schemaname = 'storage';
-- select id, public, file_size_limit from storage.buckets where id = 'avatars';
