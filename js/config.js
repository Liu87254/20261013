// Supabase 連線設定。
//
// 這兩個值可以直接 commit 進 git，沒有安全問題——
// anon public key 設計上就是給瀏覽器用的公開金鑰，真正的保護靠資料庫的 RLS 規則
// （見 supabase/schema.sql 和 docs/architecture.md 第 8 節）。
// 絕對不要把「service_role key」放進這個檔案或任何檔案裡。
//
// 怎麼拿到這兩個值：登入 supabase.com → 打開你的專案 → 左側選單
// Settings → API → 複製 "Project URL" 和 "Project API keys" 裡的 "anon public"。

export const SUPABASE_URL = "請貼上你的 Project URL（例如 https://xxxx.supabase.co）";
export const SUPABASE_ANON_KEY = "請貼上你的 anon public key";
