// 畫面的 DOM 操作都集中在這個檔案：負責「畫面上看起來長什麼樣」，
// 不知道資料是從 mock 還是 Supabase 來的（那是 chat-service.js 的事）。

const AVATAR_PALETTE = ["#FF6F91", "#2EC4B6", "#845EC2", "#F9A826", "#4D8076", "#5B8DEF"];

function avatarColorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export class ChatUI {
  constructor() {
    this.entryScreen = document.getElementById("entry-screen");
    this.chatScreen = document.getElementById("chat-screen");

    this.entryForm = document.getElementById("entry-form");
    this.nicknameInput = document.getElementById("nickname-input");
    this.nicknameError = document.getElementById("nickname-error");

    this.leaveBtn = document.getElementById("leave-btn");
    this.onlineToggleBtn = document.getElementById("online-toggle-btn");
    this.onlineCountMobile = document.getElementById("online-count-mobile");
    this.onlineCountDesktop = document.getElementById("online-count-desktop");
    this.onlineList = document.getElementById("online-list");
    this.onlineListMobile = document.getElementById("online-list-mobile");
    this.onlineOverlay = document.getElementById("online-overlay");
    this.onlineCloseBtn = document.getElementById("online-close-btn");

    this.disconnectBanner = document.getElementById("disconnect-banner");

    this.messageList = document.getElementById("message-list");
    this.jumpToBottomBtn = document.getElementById("jump-to-bottom-btn");

    this.dropZone = document.getElementById("drop-zone");
    this.draftInput = document.getElementById("draft-input");
    this.imageBtn = document.getElementById("image-btn");
    this.imageFileInput = document.getElementById("image-file-input");
    this.sendBtn = document.getElementById("send-btn");

    this._wireStaticEvents();
  }

  _wireStaticEvents() {
    this.onlineToggleBtn.addEventListener("click", () => this.setOnlinePanelOpen(true));
    this.onlineCloseBtn.addEventListener("click", () => this.setOnlinePanelOpen(false));
    this.onlineOverlay.addEventListener("click", (e) => {
      if (e.target === this.onlineOverlay) this.setOnlinePanelOpen(false);
    });

    this.messageList.addEventListener("scroll", () => {
      if (this.isScrolledNearBottom()) {
        this.showJumpToBottom(false);
      }
    });
  }

  // --- 畫面切換 ---

  showEntryScreen() {
    this.entryScreen.classList.remove("hidden");
    this.chatScreen.classList.add("hidden");
    this.nicknameInput.value = "";
    this.setNicknameError(null);
  }

  showChatScreen() {
    this.entryScreen.classList.add("hidden");
    this.chatScreen.classList.remove("hidden");
    this.messageList.innerHTML = "";
  }

  setNicknameError(msg) {
    if (msg) {
      this.nicknameError.textContent = msg;
      this.nicknameError.hidden = false;
    } else {
      this.nicknameError.hidden = true;
    }
  }

  // --- 線上名單 ---

  renderOnlineUsers(users) {
    this.onlineCountMobile.textContent = String(users.length);
    this.onlineCountDesktop.textContent = String(users.length);

    const renderInto = (ul) => {
      ul.innerHTML = "";
      users.forEach((u) => {
        const li = document.createElement("li");
        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.style.background = avatarColorFor(u.name);
        avatar.textContent = u.name.slice(0, 1);
        const name = document.createElement("span");
        name.textContent = u.name;
        li.appendChild(avatar);
        li.appendChild(name);
        ul.appendChild(li);
      });
    };

    renderInto(this.onlineList);
    renderInto(this.onlineListMobile);
  }

  setOnlinePanelOpen(open) {
    this.onlineOverlay.classList.toggle("hidden", !open);
  }

  // --- 斷線提示 / 回到底部 ---

  showDisconnectBanner(show) {
    this.disconnectBanner.classList.toggle("hidden", !show);
  }

  showJumpToBottom(show) {
    this.jumpToBottomBtn.classList.toggle("hidden", !show);
  }

  isScrolledNearBottom() {
    const el = this.messageList;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  scrollToBottom() {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  // --- 訊息列表 ---

  appendMessage(message, currentNickname, handlers) {
    const el = this._renderMessageElement(message, currentNickname, handlers);
    this.messageList.appendChild(el);

    if (this.isScrolledNearBottom()) {
      this.scrollToBottom();
    } else if (message.isSelf) {
      this.scrollToBottom();
    } else {
      this.showJumpToBottom(true);
    }
  }

  removeMessage(messageId) {
    const existing = this.messageList.querySelector(`[data-message-id="${messageId}"]`);
    if (existing) existing.remove();
  }

  updateMessage(message, currentNickname, handlers) {
    const existing = this.messageList.querySelector(`[data-message-id="${message.id}"]`);
    const el = this._renderMessageElement(message, currentNickname, handlers);
    if (existing) {
      existing.replaceWith(el);
    } else {
      this.messageList.appendChild(el);
    }
  }

  _renderMessageElement(message, currentNickname, handlers) {
    if (message.type === "system") {
      const wrap = document.createElement("div");
      wrap.className = "system-message";
      wrap.dataset.messageId = String(message.id);
      const span = document.createElement("span");
      span.textContent = message.content;
      wrap.appendChild(span);
      return wrap;
    }

    return this._renderChatMessage(message, currentNickname, handlers);
  }

  _renderChatMessage(message, currentNickname, handlers) {
    const row = document.createElement("div");
    row.className = `chat-row ${message.isSelf ? "self" : "other"}`;
    row.dataset.messageId = String(message.id);

    const inner = document.createElement("div");
    inner.className = "chat-row-inner";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.background = avatarColorFor(message.author);
    avatar.textContent = message.author.slice(0, 1);

    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const byline = document.createElement("div");
    byline.className = "chat-byline";
    const time = new Date(message.createdAt).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
    byline.textContent = `${message.author} · ${time}${message.edited ? " · 已編輯" : ""}`;
    meta.appendChild(byline);

    if (message.editing) {
      meta.appendChild(this._renderEditBox(message, handlers));
    } else {
      meta.appendChild(this._renderBubbleRow(message, handlers));
      if (message.failed) {
        const retryBtn = document.createElement("button");
        retryBtn.type = "button";
        retryBtn.className = "retry-btn";
        retryBtn.textContent = "⚠ 傳送失敗，點擊重試";
        retryBtn.addEventListener("click", () => handlers.onRetry(message.id));
        meta.appendChild(retryBtn);
      }
    }

    inner.appendChild(avatar);
    inner.appendChild(meta);
    row.appendChild(inner);
    return row;
  }

  _renderBubbleRow(message, handlers) {
    const bubbleRow = document.createElement("div");
    bubbleRow.className = "bubble-row";

    if (message.imageUrl) {
      const img = document.createElement("img");
      img.className = "bubble-image";
      img.src = message.imageUrl;
      img.alt = "聊天室圖片";
      bubbleRow.appendChild(img);
    }

    if (message.content) {
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = message.content;
      bubbleRow.appendChild(bubble);
    }

    const canEdit = message.isSelf && !message.failed;
    if (canEdit) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "edit-btn";
      editBtn.setAttribute("aria-label", "編輯訊息");
      editBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2 2 0 0 0-4-4L4 16v4z" stroke="#B5A89F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      editBtn.addEventListener("click", () => handlers.onEditStart(message.id));
      bubbleRow.appendChild(editBtn);
    }

    return bubbleRow;
  }

  _renderEditBox(message, handlers) {
    const box = document.createElement("div");
    box.className = "edit-box";

    const textarea = document.createElement("textarea");
    textarea.rows = 2;
    textarea.value = message.content;

    const actions = document.createElement("div");
    actions.className = "edit-box-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "edit-cancel-btn";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => handlers.onEditCancel(message.id));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "edit-save-btn";
    saveBtn.textContent = "儲存";
    saveBtn.addEventListener("click", () => handlers.onEditSave(message.id, textarea.value));

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    box.appendChild(textarea);
    box.appendChild(actions);
    return box;
  }
}
