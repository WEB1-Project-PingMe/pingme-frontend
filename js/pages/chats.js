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
let isDbInitialized = false;

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
            // Check if DB is empty (first time initialization)
            const chatsTx = db.transaction([chatsStoreName], "readonly");
            const chatsStore = chatsTx.objectStore(chatsStoreName);
            const chatsCountRequest = chatsStore.count();

            chatsCountRequest.onsuccess = async () => {
                const messagesTx = db.transaction([messagesStoreName], "readonly");
                const messagesStore = messagesTx.objectStore(messagesStoreName);
                const messagesCountRequest = messagesStore.count();

                messagesCountRequest.onsuccess = () => {
                    isDbInitialized = chatsCountRequest.result > 0 || messagesCountRequest.result > 0;
                    resolve(db);
                };
            };
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
                // messagesStore.createIndex("name", "name", { unique: false });
            }
        };
    });
}

async function populateFromRemote() {
    await getConversations();
    await loadChats();
    for (const chat of chats) {
        await getMessages(chat.id, 50);
    }
}

async function getConversations() {
    const result = await apiCall("/conversations");
    if (result.ok && result.data.success) {
        // TODO: change to converstations when groups is implemented
        chats = result.data.conversations.map(conv => ({
            id: conv._id,
            // TODO: Change to Contact Name
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

async function createConversation(participantId) {
    const result = await apiCall("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantId })
    });
    return result.ok ? result.data.conversationId : null;
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

function loadChats() {
    return new Promise(resolve => {
        if (!isDbInitialized) {
            resolve();
            return;
        }

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
        const timeStr = lastMsgTime ? new Date(lastMsgTime).toLocaleDateString([], {
            month: "short", day: "numeric"
        }) : "Never";

        return `
            <div class="chat-item ${currentChatId === chat.id ? "active" : ""}" data-chat-id="${chat.id}">
                <div class="chat-avatar">${chat.name.charAt(0).toUpperCase()}</div>
                <div class="chat-preview">
                    <div class="chat-name">${chat.name}</div>
                    <div class="chat-last-message">${chat.lastMessageText || timeStr}</div>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".chat-item").forEach(item => {
        item.onclick = () => selectChat(item.dataset.chatId);
    });
}

async function loadMessagesForChat(chatId) {
    const remoteMessages = await getMessages(chatId, 50);
    if (remoteMessages.length > 0) return remoteMessages;

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

function storeMessage(chatId, message) {
    const messageData = {
        ...message,
        chatId
    };
    const tx = db.transaction([messagesStoreName], "readwrite");
    const store = tx.objectStore(messagesStoreName);
    store.put(messageData);

    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chat.timestamp = message.createdAt || new Date().toISOString();
        storeChats();
        renderChatList();
    }
}

function storeMessagesForChat(chatId, messages) {
    const tx = db.transaction([messagesStoreName], "readwrite");
    const store = tx.objectStore(messagesStoreName);

    messages.forEach(msg => {
        msg["id"] = msg._id;
        const messageData = {
            ...msg,
            chatId
        };
        store.put(messageData);
    });
}

function selectChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);

    chatTitleElement.textContent = chat.name;
    chatLastTimeElement.textContent = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
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
            hour: "2-digit", minute: "2-digit"
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

async function sendMessage() {
    const text = messageInputElement.value.trim();
    if (!text || !currentChatId) return;

    messageInputElement.disabled = true;
    sendButton.disabled = true;

    const senderId = localStorage.getItem("currentUserId");
    const message = {
        id: Date.now(),
        conversationId: currentChatId,
        senderId,
        text,
        createdAt: new Date().toISOString()
    };

    await storeMessage(currentChatId, message);
    messageInputElement.value = "";
    loadAndRenderMessages();

    const success = await sendMessageToRemote(currentChatId, text);
    sendButton.disabled = false;
    messageInputElement.disabled = false;

    if (!success) {
        console.error("Failed to send message");
    }
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
        await getConversations();
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

function initEventListeners() {
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
    await initDB();

    if (!isDbInitialized) {
        await populateFromRemote();
    } else {
        await loadChats();
        renderChatList();
    }
    initEventListeners();
    /*
    setInterval(() => {
        if (currentChatId) loadAndRenderMessages();
    }, 10000);
    */
}

document.addEventListener("DOMContentLoaded", init);