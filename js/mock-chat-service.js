import { ChatService } from "./chat-service.js";

// 階段一用：完全在瀏覽器本機模擬聊天室，不連接任何後端。
// 用一些排好時間的假事件（別人加入、送訊息、離開）讓畫面看起來像真的有人在聊天室裡。
// 這個檔案實作的方法，跟 docs/architecture.md 裡「聊天服務規格書」(chat-service.js) 完全一樣，
// 階段二只需要換成 supabase-chat-service.js，main.js 不用改。

let nextId = 1000;

export class MockChatService extends ChatService {
  constructor() {
    super();
    this.nickname = null;
    this.messages = [];
    this.onlineUsers = [];
    this.messageListeners = [];
    this.messageUpdatedListeners = [];
    this.presenceListeners = [];
    this.connectionListeners = [];
    this._timers = [];
  }

  async connect(nickname) {
    this.nickname = nickname;
    this.onlineUsers = [{ name: nickname }];
    this.messages = [];

    this._scheduleDemoEvents();

    return { history: this.messages.slice(), onlineUsers: this.onlineUsers.slice() };
  }

  _scheduleDemoEvents() {
    // 模擬另一個人加入
    this._timers.push(
      setTimeout(() => {
        this.onlineUsers.push({ name: "Mochi" });
        this._emitPresence();
        this._emitMessage(this._makeSystemMessage("Mochi 加入了聊天室"));
      }, 1500)
    );

    // 模擬對方送出一則歡迎訊息
    this._timers.push(
      setTimeout(() => {
        this._emitMessage(
          this._makeChatMessage({
            author: "Mochi",
            isSelf: false,
            content: "哈囉～歡迎加入聊天室！",
          })
        );
      }, 4000)
    );

    // 模擬短暫斷線又恢復連線
    this._timers.push(
      setTimeout(() => this._emitConnection(false), 9000)
    );
    this._timers.push(
      setTimeout(() => this._emitConnection(true), 12500)
    );

    // 模擬對方離開
    this._timers.push(
      setTimeout(() => {
        this.onlineUsers = this.onlineUsers.filter((u) => u.name !== "Mochi");
        this._emitPresence();
        this._emitMessage(this._makeSystemMessage("Mochi 離開了聊天室"));
      }, 20000)
    );
  }

  sendMessage(content) {
    const text = content.trim();
    if (!text) return;

    const shouldFail = text.toLowerCase() === "fail";
    const message = this._makeChatMessage({
      author: this.nickname,
      isSelf: true,
      content: text,
      failed: shouldFail,
    });
    this.messages.push(message);
    this._notifyMessage(message);
  }

  sendImage(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const message = this._makeChatMessage({
        author: this.nickname,
        isSelf: true,
        imageUrl: reader.result,
      });
      this.messages.push(message);
      this._notifyMessage(message);
    };
    reader.readAsDataURL(file);
  }

  retryMessage(messageId) {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) return;
    message.failed = false;
    this.messageUpdatedListeners.forEach((cb) => cb(message));
  }

  editMessage(messageId, newContent) {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) return;
    message.content = newContent;
    message.edited = true;
    this.messageUpdatedListeners.forEach((cb) => cb(message));
  }

  leave() {
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    this.onlineUsers = this.onlineUsers.filter((u) => u.name !== this.nickname);
    this.nickname = null;
  }

  onMessage(callback) {
    this.messageListeners.push(callback);
  }

  onMessageUpdated(callback) {
    this.messageUpdatedListeners.push(callback);
  }

  onPresenceChange(callback) {
    this.presenceListeners.push(callback);
  }

  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
  }

  // --- 內部工具方法 ---

  _makeSystemMessage(content) {
    const message = { id: nextId++, type: "system", content, createdAt: Date.now() };
    this.messages.push(message);
    return message;
  }

  _makeChatMessage({ author, isSelf, content, imageUrl, failed }) {
    return {
      id: nextId++,
      type: "chat",
      author,
      isSelf,
      content: content || "",
      imageUrl: imageUrl || null,
      failed: !!failed,
      edited: false,
      createdAt: Date.now(),
    };
  }

  _emitMessage(message) {
    this._notifyMessage(message);
  }

  _notifyMessage(message) {
    this.messageListeners.forEach((cb) => cb(message));
  }

  _emitPresence() {
    this.presenceListeners.forEach((cb) => cb(this.onlineUsers.slice()));
  }

  _emitConnection(isConnected) {
    this.connectionListeners.forEach((cb) => cb(isConnected));
  }
}
