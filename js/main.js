// 程式進入點：把畫面（ui.js）和聊天服務（chat-service.js 的其中一份實作）串接起來。
//
// 階段一只有這一行會指到「本機模擬」的實作：
import { MockChatService } from "./mock-chat-service.js";
// 階段二接上 Supabase 時，改成：
// import { SupabaseChatService } from "./supabase-chat-service.js";
// 下面全部程式碼都不需要再改。

import { ChatUI } from "./ui.js";

const chatService = new MockChatService();
const ui = new ChatUI();

let currentNickname = null;
const messagesById = new Map();
const editingIds = new Set();

function withEditingFlag(message) {
  return { ...message, editing: editingIds.has(message.id) };
}

function rerenderMessage(id) {
  const message = messagesById.get(id);
  if (message) ui.updateMessage(withEditingFlag(message), currentNickname, handlers);
}

const handlers = {
  onEditStart(id) {
    editingIds.add(id);
    rerenderMessage(id);
  },
  onEditCancel(id) {
    editingIds.delete(id);
    rerenderMessage(id);
  },
  onEditSave(id, newContent) {
    editingIds.delete(id);
    chatService.editMessage(id, newContent.trim());
  },
  onRetry(id) {
    chatService.retryMessage(id);
  },
};

chatService.onMessage((message) => {
  messagesById.set(message.id, message);
  ui.appendMessage(withEditingFlag(message), currentNickname, handlers);
});

chatService.onMessageUpdated((message) => {
  messagesById.set(message.id, message);
  ui.updateMessage(withEditingFlag(message), currentNickname, handlers);
});

chatService.onMessageRemoved((messageId) => {
  messagesById.delete(messageId);
  ui.removeMessage(messageId);
});

chatService.onPresenceChange((onlineUsers) => {
  ui.renderOnlineUsers(onlineUsers);
});

chatService.onConnectionChange((isConnected) => {
  ui.showDisconnectBanner(!isConnected);
});

// --- 畫面 A：輸入代號 ---

ui.entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = ui.nicknameInput.value.trim();
  if (!nickname) {
    ui.setNicknameError("請先輸入一個代號才能進入聊天室喔！");
    return;
  }

  currentNickname = nickname;
  const { history, onlineUsers } = await chatService.connect(nickname);

  ui.showChatScreen();
  messagesById.clear();
  history.forEach((message) => {
    messagesById.set(message.id, message);
    ui.appendMessage(withEditingFlag(message), currentNickname, handlers);
  });
  ui.renderOnlineUsers(onlineUsers);
  ui.showJumpToBottom(false);
  ui.scrollToBottom();
});

ui.nicknameInput.addEventListener("input", () => ui.setNicknameError(null));

// --- 畫面 B：聊天室 ---

ui.leaveBtn.addEventListener("click", () => {
  chatService.leave();
  messagesById.clear();
  editingIds.clear();
  currentNickname = null;
  ui.showEntryScreen();
});

ui.jumpToBottomBtn.addEventListener("click", () => {
  ui.scrollToBottom();
  ui.showJumpToBottom(false);
});

function sendDraft() {
  const text = ui.draftInput.value;
  if (!text.trim()) return;
  chatService.sendMessage(text);
  ui.draftInput.value = "";
}

ui.draftInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendDraft();
  }
});

ui.sendBtn.addEventListener("click", sendDraft);

ui.imageBtn.addEventListener("click", () => ui.imageFileInput.click());

ui.imageFileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) chatService.sendImage(file);
  ui.imageFileInput.value = "";
});

ui.dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  ui.dropZone.classList.add("dragging");
});

ui.dropZone.addEventListener("dragleave", () => {
  ui.dropZone.classList.remove("dragging");
});

ui.dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  ui.dropZone.classList.remove("dragging");
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) chatService.sendImage(file);
});

ui.draftInput.addEventListener("paste", (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.indexOf("image") === 0) {
      const file = item.getAsFile();
      if (file) chatService.sendImage(file);
    }
  }
});

// --- 啟動畫面 ---

ui.showEntryScreen();
