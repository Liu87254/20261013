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
  is_edited boolean not null default false
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

-- 6. 開啟 Realtime（即時推播）：資料表有新增/修改時，自動推播給所有連線中的瀏覽器。
alter publication supabase_realtime add table public.messages;

-- 7. 圖片存放空間：建立一個叫 chat-images 的 bucket（儲存空間），設成公開可讀，
--    這樣訊息裡的圖片網址誰都能打開看，但只有登入中的使用者能上傳新圖片。
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

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
