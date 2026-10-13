// 這是「聊天服務」的規格書（見 docs/architecture.md 第 4 節）。
// 畫面程式碼（main.js、ui.js）只會呼叫這份規格書定義的方法，
// 不會知道資料實際上是來自本機模擬（mock-chat-service.js）還是 Supabase（supabase-chat-service.js）。
// 階段二接上 Supabase 時，只需要新增一份實作這份規格書的 SupabaseChatService，
// main.js 裡換一行 import 就能切換，畫面程式碼完全不用改。

export class ChatService {
  /**
   * 進入聊天室：帶著代號連線，回傳目前的歷史訊息和線上名單。
   * @param {string} nickname
   * @returns {Promise<{ history: object[], onlineUsers: object[] }>}
   */
  async connect(nickname) {
    throw new Error("ChatService.connect() 尚未實作");
  }

  /** 送出一則文字訊息 */
  sendMessage(content) {
    throw new Error("ChatService.sendMessage() 尚未實作");
  }

  /** 送出一張圖片（File 物件） */
  sendImage(file) {
    throw new Error("ChatService.sendImage() 尚未實作");
  }

  /** 重新送出一則失敗的訊息 */
  retryMessage(messageId) {
    throw new Error("ChatService.retryMessage() 尚未實作");
  }

  /** 編輯自己的訊息 */
  editMessage(messageId, newContent) {
    throw new Error("ChatService.editMessage() 尚未實作");
  }

  /** 離開聊天室 */
  leave() {
    throw new Error("ChatService.leave() 尚未實作");
  }

  /** 有新訊息（含系統提示）時呼叫 callback(message) */
  onMessage(callback) {
    throw new Error("ChatService.onMessage() 尚未實作");
  }

  /** 有訊息被編輯時呼叫 callback(message) */
  onMessageUpdated(callback) {
    throw new Error("ChatService.onMessageUpdated() 尚未實作");
  }

  /** 線上名單變化時呼叫 callback(onlineUsers) */
  onPresenceChange(callback) {
    throw new Error("ChatService.onPresenceChange() 尚未實作");
  }

  /** 連線狀態變化時呼叫 callback(isConnected) */
  onConnectionChange(callback) {
    throw new Error("ChatService.onConnectionChange() 尚未實作");
  }

  /**
   * （可選）某則訊息要從畫面上整個移除時呼叫 callback(messageId)。
   * 目前只有「傳送失敗後重試成功」這種情況會用到：
   * 先移除畫面上「失敗」的那個暫時訊息，等真正送出成功的訊息透過 onMessage 進來。
   * 不需要這個機制的實作（例如本機模擬版）可以不覆寫這個方法，預設什麼都不做。
   */
  onMessageRemoved(callback) {
    // 預設不做任何事：base class 提供空實作，讓不需要這個機制的實作可以不處理。
  }
}
