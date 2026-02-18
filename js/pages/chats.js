const messagesElement = document.getElementById("messages");
const messageInputElement = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const refreshButton = document.getElementById("refreshButton");
const chatListElement = document.getElementById("chatList");
const chatContainerElement = document.getElementById("chatContainer");
const noChatSelectedElement = document.getElementById("noChatSelected");
const newChatButton = document.getElementById("newChatButton");
const backButton = document.getElementById("backButton");
const chatTitleElement = document.getElementById("chatTitle");
const chatLastTimeElement = document.getElementById("chatLastTime");
const newChatModalElement = document.getElementById("newChatModal");
const participantSearchElement = document.getElementById("participantSearch");
const userListElement = document.getElementById("userList");
const closeModalButton = document.getElementById("closeModalButton");
const cancelNewChatButton = document.getElementById("cancelNewChat");

let users = [];
let chats = [];
let currentChatId = null;
let db;
let pusher = new Pusher('d8e5b208992682efa26f', {
    cluster: 'eu'
});

const DB_NAME = "PingMeDB";
const messagesStoreName = "messages";
const chatsStoreName = "chats";
const currentUserId = localStorage.getItem("currentUserId");
const BACKEND_URL = "https://pingme-backend-nu.vercel.app";

async function apiCall(url, options = {}) {
    try {
        const token = localStorage.getItem("sessionToken");
        const response = await fetch(BACKEND_URL + url, {
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` }),
                ...options.headers
            },
            ...options
        });

        if (response.status === 401) {
            localStorage.removeItem("sessionToken");
            window.location.href = "/login";
            throw new Error("Session expired");
        }

        const data = await response.json();
        return { response, data, ok: response.ok };
    } catch (error) {
        console.error("API call failed:", error);
        return { error: error.message };
    }
}

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);

        request.onerror = () => reject(request.error);
        request.onsuccess = async () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            db = e.target.result;

            if (!db.objectStoreNames.contains(chatsStoreName)) {
                const chatsStore = db.createObjectStore(chatsStoreName, { keyPath: "id" });
                chatsStore.createIndex("name", "name", { unique: false });
            }

            if (!db.objectStoreNames.contains(messagesStoreName)) {
                const messagesStore = db.createObjectStore(messagesStoreName, { keyPath: "id" });
                messagesStore.createIndex("chatId", "chatId", { unique: false });
            }
        };
    });
}

async function syncLocalWithBackend() {
    // Get all conversations from backend
    await getConversations();

    await clearLocalData();

    if (chats.length > 0) {
        for (const chat of chats) {
            await getMessages(chat.id, 1000);
        }
    }

    renderChatList();
    if (currentChatId) {
        loadAndRenderMessages();
    }
    subscribeToChannels();
}

async function clearLocalData() {
    // Clear chats
    await new Promise((resolve) => {
        const tx = db.transaction([chatsStoreName], "readwrite");
        const store = tx.objectStore(chatsStoreName);
        store.clear();
        tx.oncomplete = resolve;
        tx.onerror = () => console.error("Clear chats failed");
    });
    
    // Clear messages
    await new Promise((resolve) => {
        const tx = db.transaction([messagesStoreName], "readwrite");
        const store = tx.objectStore(messagesStoreName);
        store.clear();
        tx.oncomplete = resolve;
        tx.onerror = () => console.error("Clear messages failed");
    });
}

async function getConversations() {
    const result = await apiCall("/conversations");
    if (result.ok && result.data.success) {
        chats = result.data.conversations.map(conv => ({
            id: conv._id,
            name: conv.participants[0]?.name || conv.participants[0]?.userTag || "Unknown Chat",
            timestamp: conv.lastMessageAt || conv.updatedAt,
            lastMessageText: conv.lastMessageText,
            participants: conv.participants
        }));
        storeChats();
        renderChatList();
    }
}

async function getMessages(conversationId, limit = 50, before = null) {
    const params = new URLSearchParams({ conversationId, limit });
    if (before) params.append("before", before);

    const result = await apiCall(`/conversations/messages?${params}`);
    if (result.ok) {
        const messages = result.data.messages || [];
        storeMessagesForChat(conversationId, messages);
        return messages;
    }
    return [];
}

async function sendMessageToRemote(conversationId, text) {
    const senderId = localStorage.getItem("currentUserId");
    const result = await apiCall("/conversations/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId, senderId, text })
    });
    return result.ok;
}

function storeChats() {
    const tx = db.transaction([chatsStoreName], "readwrite");
    const store = tx.objectStore(chatsStoreName);
    chats.forEach(chat => store.put(chat));
}

function storeMessagesForChat(chatId, messages) {
    const tx = db.transaction([messagesStoreName], "readwrite");
    const store = tx.objectStore(messagesStoreName);

    messages.forEach(msg => {
        msg.id = msg._id;
        const messageData = { ...msg, chatId };
        store.put(messageData);
    });
}

function loadChats() {
    return new Promise(resolve => {
        const tx = db.transaction([chatsStoreName]);
        const store = tx.objectStore(chatsStoreName);
        const request = store.getAll();

        request.onsuccess = () => {
            chats = request.result;
            resolve();
        };
    });
}

function renderChatList() {
    chatListElement.innerHTML = chats.map(chat => {
        const lastMsgTime = chat.timestamp;
        const timeStr = lastMsgTime ? new Date(lastMsgTime).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", hour12: false
        }) : "Never";

        return `
            <div class="chat-item ${currentChatId === chat.id ? "active" : ""}" data-chat-id="${chat.id}">
                <div class="chat-avatar">${chat.name.charAt(0).toUpperCase()}</div>
                <div class="chat-preview">
                    <div class="chat-name">${chat.name}</div>
                    <div class="chat-last-message">${timeStr}: ${chat.lastMessageText || ''}</div>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".chat-item").forEach(item => {
        item.onclick = () => selectChat(item.dataset.chatId);
    });
}

function updateChatLastMessage(chat) {
    const time = formatTime(chat.lastMessageAt || Date.now());
    const item = document.querySelector(`.chat-item[data-chat-id="${chat.id}"]`);
    if (!item) return;

    const lastMsgNode = item.querySelector('.chat-last-message');
    if (!lastMsgNode) return;

    lastMsgNode.textContent = `${time}: ${chat.lastMessageText || ''}`;
}

async function loadMessagesForChat(chatId) {
    const tx = db.transaction([messagesStoreName]);
    const store = tx.objectStore(messagesStoreName);
    const index = store.index("chatId");
    const request = index.getAll(chatId);

    return new Promise(resolve => {
        request.onsuccess = () => {
            const messages = request.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            resolve(messages);
        };
    });
}

function selectChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    console.log(chats);
    console.log(chat);

    chatTitleElement.textContent = chat.name;
    chatLastTimeElement.textContent = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit", hour12: false
    }) : "";

    noChatSelectedElement.style.display = "none";
    chatContainerElement.style.display = "flex";

    renderChatList();
    loadAndRenderMessages();
}

async function loadAndRenderMessages() {
    if (!currentChatId) return;
    const messages = await loadMessagesForChat(currentChatId);
    renderMessages(messages);
}

function renderMessages(messages) {
    messages = [...messages].reverse();

    messagesElement.innerHTML = messages.slice(0, 50).map(msg => {
        const time = new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", hour12: false
        });
        const isSent = msg.senderId === localStorage.getItem("currentUserId");

        return `
            <div class="message ${isSent ? "sent" : "received"}">
                ${msg.text}
                <div class="message-time">${time}</div>
            </div>
        `;
    }).join("");

    messagesElement.scrollTop = messagesElement.scrollHeight;
}

const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
};

const escapeHtml = (str) => {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

function appendNewMessage(msg) {
    const time = formatTime(msg.createdAt || msg.timestamp);
    const isSent = msg.senderId === localStorage.getItem("currentUserId");

    const msgHtml = `
        <div class="message ${isSent ? "sent" : "received"}">
            ${escapeHtml(msg.text)}
            <div class="message-time">${time}</div>
        </div>
    `;

    messagesElement.insertAdjacentHTML("beforeend", msgHtml);
    messagesElement.scrollTop = messagesElement.scrollHeight;
}

async function sendMessage() {
    const text = messageInputElement.value.trim();
    if (!text || !currentChatId) return;

    messageInputElement.disabled = true;
    sendButton.disabled = true;

    // 1. Send to backend FIRST
    const success = await sendMessageToRemote(currentChatId, text);

    if (success) {
        // 2. Backend succeeded, refresh local data for this chat
        await getMessages(currentChatId, 50);
        await loadAndRenderMessages();
    } else {
        console.error("Failed to send message to backend");
        alert("Failed to send message. Please try again.");
    }

    messageInputElement.value = "";
    messageInputElement.disabled = false;
    sendButton.disabled = false;
}

async function searchUsers(query) {
    const result = await apiCall(`/users/search/${encodeURIComponent(query)}`);
    if (result.ok) {
        users = result.data.users || [];
        renderUserList();
    }
}

function renderUserList() {
    if (users.length === 0) {
        userListElement.innerHTML = "";
        document.querySelector(".no-users").style.display = "block";
        return;
    }

    document.querySelector(".no-users").style.display = "none";
    userListElement.innerHTML = users.map(user => `
        <div class="user-item" data-user-id="${user._id}">
            <div class="user-avatar">${user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <h4>${user.name || user.email}</h4>
                <p>#${user.tag}</p>
            </div>
        </div>
    `).join("");

    document.querySelectorAll(".user-item").forEach(item => {
        item.onclick = () => createNewConversation(item.dataset.userId);
    });
}

async function createNewConversation(participantId) {
    const result = await apiCall("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantId })
    });

    if (result.ok) {
        const conversationId = result.data.conversationId;

        // Backend created it, now sync everything
        await syncLocalWithBackend();
        closeModal();
        selectChat(conversationId);
    } else {
        alert(result.data?.error || "Failed to create chat");
    }
}

function openModal() {
    newChatModalElement.style.display = "flex";
    participantSearchElement.focus();
}

function closeModal() {
    newChatModalElement.style.display = "none";
    participantSearchElement.value = "";
    users = [];
    renderUserList();
}

function subscribeToChannels() {
    // Unsubscribe from all existing channels first
    pusher.allChannels().forEach(channel => {
        pusher.unsubscribe(channel.name);
    });

    // Subscribe to current chats
    for (const chat of chats) {
        const channelName = `conversation-${chat.id}`;
        const channel = pusher.subscribe(channelName);

        channel.unbind('new-message');
        channel.bind('new-message', function (data) {
            appendNewMessage(data.message);
            // Refresh chat list to update timestamps
            getConversations();
        });
    }
}

function initEventListeners() {
    console.log("init eventListeners")
    document.getElementById("newChatButton").onclick = openModal;
    closeModalButton.onclick = closeModal;
    cancelNewChatButton.onclick = closeModal;

    newChatModalElement.onclick = (e) => {
        if (e.target === newChatModalElement) closeModal();
    };

    participantSearchElement.oninput = (e) => {

        const query = e.target.value.trim();
        if (query.length < 3) {
            users = [];
            renderUserList();
            return
        }

        searchUsers(query);
    }

    document.getElementById("backButton").onclick = () => {
        currentChatId = null;
        noChatSelectedElement.style.display = "flex";
        chatContainerElement.style.display = "none";
        renderChatList();
    };

    document.getElementById("sendButton").onclick = sendMessage;
    document.getElementById("refreshButton").onclick = loadAndRenderMessages;
    messageInputElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

async function init() {
    console.log("1.")
    await initDB();

    await syncLocalWithBackend();

    var conversation_channel = pusher.subscribe(`conversation`);
    conversation_channel.bind('new-conversation', async function (data) {
        await syncLocalWithBackend();
    });
    console.log("2.")

    initEventListeners();
}

document.addEventListener("DOMContentLoaded", init);
