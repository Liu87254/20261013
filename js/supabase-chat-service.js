import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { ChatService } from "./chat-service.js";

// 階段二用：真正呼叫 Supabase 的實作。
// 這個檔案實作的方法，跟 docs/architecture.md 裡「聊天服務規格書」(chat-service.js) 完全一樣，
// 所以 main.js 只要把 import 從 mock-chat-service.js 換成這個檔案，畫面程式碼完全不用改。

export class SupabaseChatService extends ChatService {
  constructor() {
    super();
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.nickname = null;
    this.userId = null;
    this.messagesChannel = null;
    this.presenceChannel = null;
    this.messageListeners = [];
    this.messageUpdatedListeners = [];
    this.messageRemovedListeners = [];
    this.presenceListeners = [];
    this.connectionListeners = [];
    this.pendingRetries = new Map(); // 失敗訊息的暫時 id -> 要重送的內容
  }

  async connect(nickname) {
    this.nickname = nickname;

    const { data: authData, error: authError } = await this.client.auth.signInAnonymously();
    if (authError) throw authError;
    this.userId = authData.user.id;

    const { data: rows, error: historyError } = await this.client
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    if (historyError) throw historyError;

    const history = rows.map((row) => this._rowToMessage(row));

    this._subscribeToMessages();
    const onlineUsers = await this._joinPresence();

    this._insertSystemMessage(`${nickname} 加入了聊天室`);

    return { history, onlineUsers };
  }

  sendMessage(content) {
    const text = content.trim();
    if (!text) return;

    this.client
      .from("messages")
      .insert({ type: "chat", author_id: this.userId, author_name: this.nickname, content: text })
      .then(({ error }) => {
        if (error) this._emitLocalFailure({ kind: "text", content: text });
        // 成功的話，不用在這裡做任何事：Realtime 會把這筆新訊息推播回來（見 _subscribeToMessages）。
      });
  }

  sendImage(file) {
    const path = `${this.userId}/${Date.now()}-${file.name}`;
    this.client.storage
      .from("chat-images")
      .upload(path, file)
      .then(({ error: uploadError }) => {
        if (uploadError) {
          this._emitLocalFailure({ kind: "image", file });
          return;
        }
        const { data } = this.client.storage.from("chat-images").getPublicUrl(path);
        return this.client
          .from("messages")
          .insert({ type: "chat", author_id: this.userId, author_name: this.nickname, image_url: data.publicUrl })
          .then(({ error: insertError }) => {
            if (insertError) this._emitLocalFailure({ kind: "image", file });
          });
      });
  }

  retryMessage(messageId) {
    const pending = this.pendingRetries.get(messageId);
    if (!pending) return;
    this.pendingRetries.delete(messageId);
    this.messageRemovedListeners.forEach((cb) => cb(messageId));

    if (pending.kind === "text") {
      this.sendMessage(pending.content);
    } else {
      this.sendImage(pending.file);
    }
  }

  editMessage(messageId, newContent) {
    this.client
      .from("messages")
      .update({ content: newContent, is_edited: true, edited_at: new Date().toISOString() })
      .eq("id", messageId)
      .then(({ error }) => {
        if (error) console.error("編輯訊息失敗（可能已經超過 5 分鐘）：", error.message);
        // 成功的話，Realtime 會推播 UPDATE 事件回來，畫面會自動更新。
      });
  }

  async leave() {
    if (this.nickname) {
      await this._insertSystemMessage(`${this.nickname} 離開了聊天室`);
    }
    if (this.presenceChannel) {
      await this.presenceChannel.untrack();
      this.client.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    if (this.messagesChannel) {
      this.client.removeChannel(this.messagesChannel);
      this.messagesChannel = null;
    }
    this.nickname = null;
  }

  onMessage(callback) {
    this.messageListeners.push(callback);
  }

  onMessageUpdated(callback) {
    this.messageUpdatedListeners.push(callback);
  }

  onMessageRemoved(callback) {
    this.messageRemovedListeners.push(callback);
  }

  onPresenceChange(callback) {
    this.presenceListeners.push(callback);
  }

  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
  }

  // --- 內部工具方法 ---

  _rowToMessage(row) {
    return {
      id: row.id,
      type: row.type,
      author: row.author_name,
      isSelf: row.author_id === this.userId,
      content: row.content || "",
      imageUrl: row.image_url || null,
      failed: false,
      edited: row.is_edited,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  _subscribeToMessages() {
    this.messagesChannel = this.client
      .channel("messages-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const message = this._rowToMessage(payload.new);
        this.messageListeners.forEach((cb) => cb(message));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const message = this._rowToMessage(payload.new);
        this.messageUpdatedListeners.forEach((cb) => cb(message));
      })
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        this.connectionListeners.forEach((cb) => cb(connected));
      });
  }

  _joinPresence() {
    this.presenceChannel = this.client.channel("online-users", {
      config: { presence: { key: this.userId } },
    });

    this.presenceChannel.on("presence", { event: "sync" }, () => {
      const state = this.presenceChannel.presenceState();
      const users = Object.values(state).map((entries) => ({ name: entries[0].name }));
      this.presenceListeners.forEach((cb) => cb(users));
    });

    return new Promise((resolve) => {
      this.presenceChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.presenceChannel.track({ name: this.nickname });
          const state = this.presenceChannel.presenceState();
          const users = Object.values(state).map((entries) => ({ name: entries[0].name }));
          resolve(users);
        }
      });
    });
  }

  _insertSystemMessage(content) {
    return this.client
      .from("messages")
      .insert({ type: "system", author_id: this.userId, author_name: this.nickname, content });
  }

  _emitLocalFailure({ kind, content, file }) {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.pendingRetries.set(id, { kind, content, file });
    const message = {
      id,
      type: "chat",
      author: this.nickname,
      isSelf: true,
      content: content || "",
      imageUrl: null,
      failed: true,
      edited: false,
      createdAt: Date.now(),
    };
    this.messageListeners.forEach((cb) => cb(message));
  }
}
