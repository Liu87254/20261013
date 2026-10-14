-- 這份 SQL 要在 Supabase 後台的「SQL Editor」裡執行一次，用來建立這個聊天室需要的資料庫結構。
-- 操作方式：登入 supabase.com → 打開你的專案 → 左側選單「SQL Editor」→ New query →
-- 把這整份檔案貼進去 → 按 Run。
--
-- 這份 SQL 對應 docs/architecture.md 第 5、8、9 節的設計。

-- 1. 訊息資料表：所有聊天訊息（包含加入/離開的系統提示）都存在這裡，永久保留。
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('chat', 'system')),
  author_id uuid not null default auth.uid(),
  author_name text not null,
  content text,
  image_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  is_edited boolean not null default false,
  check (type = 'system' or content is not null or image_url is not null)
);

-- 2. 打開 RLS（Row Level Security，資料庫層級的存取權限規則）。
--    打開之後，資料表預設「誰都不能讀寫」，要靠下面的 policy 一條一條開放。
alter table public.messages enable row level security;

-- 3. 任何人（包含匿名登入的使用者）都可以讀取所有訊息，讓新加入的人能看到完整歷史。
create policy "anyone can read messages"
  on public.messages for select
  using (true);

-- 4. 只有「登入中的使用者」可以新增訊息，而且這則訊息的 author_id 必須是自己的身分
--    （不能冒充別人送訊息）。匿名登入的使用者在 Supabase 裡也算是「登入中」。
create policy "authenticated users can insert their own messages"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = author_id);

-- 5. 只有「訊息原本的作者」，而且「送出後 5 分鐘內」，才能修改這則訊息。
--    這一條是真正擋住「偽造編輯別人訊息」或「超過時間還硬改」的關鍵，
--    前端畫面上的「編輯」按鈕只是方便使用者，真正的把關在這裡。
create policy "authors can edit their own recent messages"
  on public.messages for update
  to authenticated
  using (auth.uid() = author_id and now() - created_at < interval '5 minutes')
  with check (auth.uid() = author_id);

-- 5.1 只靠上面的 policy 還不夠：policy 只檢查 author_id 沒變，
--     沒擋住「順便把 created_at / type / author_name 也改掉」這種事。
--     例如：把 created_at 改成現在時間，就能讓「5 分鐘內才能編輯」這條規則失效，
--     變成可以無限期一直編輯；或把 type 從 chat 改成 system，偽造系統提示。
--     用 trigger 鎖住這幾個欄位，update 時只准許改 content / image_url / edited_at / is_edited。
create or replace function public.lock_immutable_message_fields()
returns trigger as $$
begin
  if new.created_at <> old.created_at
     or new.type <> old.type
     or new.author_id <> old.author_id
     or new.author_name <> old.author_name then
    raise exception 'cannot modify created_at, type, author_id or author_name';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists messages_lock_immutable on public.messages;
create trigger messages_lock_immutable
  before update on public.messages
  for each row execute function public.lock_immutable_message_fields();

-- 5.2 防洗版：同一個身分 10 秒內最多送 5 則訊息，超過就擋下來（資料庫層的把關，
--     前端鎖輸入框只是減少誤觸，真正擋住跳過畫面直接呼叫的人要靠這裡）。
create or replace function public.enforce_message_rate_limit()
returns trigger as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.messages
  where author_id = new.author_id
    and created_at > now() - interval '10 seconds';

  if recent_count >= 5 then
    raise exception 'rate limit exceeded: too many messages in a short time';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();

-- 6. 開啟 Realtime（即時推播）：資料表有新增/修改時，自動推播給所有連線中的瀏覽器。
alter publication supabase_realtime add table public.messages;

-- 7. 圖片存放空間：建立一個叫 chat-images 的 bucket（儲存空間），設成公開可讀，
--    這樣訊息裡的圖片網址誰都能打開看，但只有登入中的使用者能上傳新圖片。
--    allowed_mime_types / file_size_limit 是資料庫端再做一次「只接受圖片、限制大小」
--    的檢查（對應 docs/architecture.md 第 9.1 節），就算有人跳過前端直接呼叫 Storage API
--    也會被擋下來。file_size_limit 單位是 bytes，這裡設 5MB。
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'chat-images',
  'chat-images',
  true,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  5242880
)
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types,
  file_size_limit = excluded.file_size_limit;

create policy "anyone can view chat images"
  on storage.objects for select
  using (bucket_id = 'chat-images');

create policy "authenticated users can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');

-- 注意：執行完這份 SQL 之後，還要記得到
-- Authentication → Sign In / Providers → 把「Anonymous Sign-ins」打開，
-- 否則網站沒辦法用匿名登入連上 Supabase（詳見 README 或問 Claude）。
