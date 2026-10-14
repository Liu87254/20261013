# 需求說明

## 這是什麼
一個不用登入的匿名聊天室。所有人在同一個聊天室裡。

## 誰會用
任何知道網站連結的人都可以進來用, 可以用電腦, 也可以用手機來操作。

## 使用的流程
1. 打開網頁
2. 輸入一個代號
3. 進入聊天室，看到其他人的訊息，也可以送出訊息
4. （其他你想到的）

## 畫面上要有
- 誰在線上
- 有人進來或離開時要有提示
- （其他你想要的）

## 不需要的
- 註冊、登入
- （其他你確定不要的）

## 技術上我知道的
- 網頁放在 GitHub Pages
- 即時傳訊用 Supabase，透過 WebSocket
- 畫面設計用 /design，前端用 /frontend-design 做出來

## 做事的順序
1. 先把前端做好，放上 GitHub Pages 看得到
2. 最後才接上 Supabase

## 我不知道、需要你幫我決定並解釋的
- 前端要用什麼語言和框架
- Supabase 要怎麼設定
- 金鑰怎麼產生、要放在哪裡

## 新增功能

除了基本的聊天室功能以外，另外做了這些：

- **分頁標題顯示未讀數（A 級）**：切到別的分頁、視窗時，如果聊天室收到其他人的新訊息，分頁標題會顯示未讀則數（例如 `(3) 匿名聊天室`），切回來就會消失。只在自己的瀏覽器裡看得到，不會同步給別人。實作在 `js/main.js`。
- **編輯自己的訊息，即時同步給所有人（B 級）**：自己送出的訊息在 5 分鐘內可以編輯，編輯後會透過 Supabase Realtime 的 `UPDATE` 事件即時推播給聊天室裡所有人，大家都會看到內容更新、並顯示「（已編輯）」，不用重新整理頁面。實作在 `js/supabase-chat-service.js` 的 `editMessage()`，時間限制由 `supabase/schema.sql` 的 RLS 規則和 trigger 在資料庫層級強制執行。
- **用 Supabase Storage 傳圖片（C 級）**：訊息可以夾帶圖片，圖片檔案存在 Supabase Storage，訊息只存圖片網址。前端（`js/supabase-chat-service.js` 的 `sendImage()`）和資料庫端（`supabase/schema.sql` 的 Storage bucket 設定）都有檢查檔案類型（只接受 png/jpeg/gif/webp）和大小（5MB 上限）。
- **資料庫層級限制發送頻率（C 級）**：同一個身分 10 秒內最多送 5 則訊息，超過會被資料庫擋下來，不是只靠前端擋。實作在 `supabase/schema.sql` 的 `enforce_message_rate_limit` trigger。
