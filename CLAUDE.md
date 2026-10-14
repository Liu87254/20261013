# CLAUDE.md

這是一個不用登入的匿名聊天室網站：前端放在 GitHub Pages，即時通訊與資料儲存用 Supabase。

- **開始任何工作前，先讀 `docs/architecture.md`**，了解整體架構、技術選擇與分階段設計，再動手。
- 目前專案進度在**階段二**：已接上 Supabase，前端透過 `js/supabase-chat-service.js` 呼叫真正的 Supabase 服務（見 `docs/architecture.md` 第 4 節）。
- **不可以把金鑰檔案 commit 進 git**。尤其是 Supabase 的 `service_role key`（服務角色金鑰）絕對不能出現在任何程式碼或檔案裡；任何看起來像密鑰、憑證的檔案都不要加入 git（見 `docs/architecture.md` 第 8 節的說明）。
