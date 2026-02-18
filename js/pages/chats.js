const messagesElement = document.getElementById("messages");
const messageInputElement = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
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

function validateChatId(chatId, context = "unknown") {
    if (!chatId || chatId.length !== 24) {
        console.error(`Invalid chatId "${chatId}" in ${context}`);
        return false;
    }
    return true;
}

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
        chats = (result.data.conversations || []).map(conv => ({
            id: conv._id,
            name: conv.participants[0]?.name || conv.participants[0]?.userTag || "Unknown Chat",
            timestamp: conv.lastMessageAt || conv.updatedAt,
            lastMessageText: conv.lastMessageText,
            participants: conv.participants
        }));
        storeChats();
        return chats;
    }
    return [];
}

async function storeNewConversation(conversationId) {
    const result = await apiCall(`/conversations/conversation/${conversationId}`);
    if (result.ok && result.data.success) {
        const conversation = result.data.conversation;
        const chat = {
            id: conversation._id,
            name: conversation.participants[0]?.name || conversation.participants[0]?.userTag || "Unknown Chat",
            timestamp: conversation.lastMessageAt || conversation.updatedAt,
            lastMessageText: conversation.lastMessageText,
            participants: conversation.participants
        };
        const tx = db.transaction([chatsStoreName], "readwrite");
        const store = tx.objectStore(chatsStoreName);
        store.put(chat);
    }
}

async function getMessages(conversationId, limit = 50, before = null) {
    if (!validateChatId(conversationId, "getMessages")) return [];

    const params = new URLSearchParams({ conversationId, limit });
    if (before) params.append("before", before);

    const result = await apiCall(`/conversations/messages?${params}`);
    if (result.ok) {
        storeMessagesForChat(conversationId, result.data.messages || []);
        return result.data.messages || [];
    }
    return [];
}

async function sendMessageToRemote(conversationId, text) {
    if (!validateChatId(conversationId, "sendMessage")) return false;

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

function storeMessage(chatId, message) {
    message.id = message._id || Date.now().toString();
    const messageData = { ...message, chatId };

    const tx = db.transaction([messagesStoreName], "readwrite");
    const store = tx.objectStore(messagesStoreName);
    store.put(messageData);
}

async function initialSync() {
    await getConversations();
    await clearLocalData();

    for (const chat of chats) {
        await getMessages(chat.id, 50); // Only recent 50 messages
    }

    renderChatList();
    subscribeToChannels();
}

async function appendMessageLocally(chatId, message) {
    await loadChats()
    storeMessage(chatId, message);
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        chat.timestamp = message.createdAt || new Date().toISOString();
        chat.lastMessageText = message.text;
        storeChats();
        renderChatList();
    }

    if (currentChatId === chatId) {
        appendNewMessage(message);
    }
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
    if (!validateChatId(chatId, "selectChat")) return;

    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    subscribeToChat(chatId);

    chatTitleElement.textContent = chat.name;
    chatLastTimeElement.textContent = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit", hour12: false
    }) : "";

    noChatSelectedElement.style.display = "none";
    chatContainerElement.style.display = "flex";

    showChatMobile();

    loadAndRenderMessages();
    renderChatList();
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
                ${escapeHtml(msg.text)}
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
    //sendButton.textContent = "Sending...";

    const success = await sendMessageToRemote(currentChatId, text);

    messageInputElement.value = "";

    if (!success) {
        alert("Failed to send message");
    }

    messageInputElement.disabled = false;
    sendButton.disabled = false;
    //sendButton.textContent = "Send";
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
        document.querySelector(".no-users") && (document.querySelector(".no-users").style.display = "block");
        return;
    }

    document.querySelector(".no-users") && (document.querySelector(".no-users").style.display = "none");
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

function isMobile() {
    let output = window.innerWidth <= 768
    return output;
}

function showChatListMobile() {
    if (!isMobile()) return;
    document.querySelector(".chat-sidebar").classList.add("mobile-show-sidebar");
    document.querySelector(".chat-main").classList.remove("mobile-show-chat");
    const inputContainer = document.getElementById('chatInputContainer');
    if (inputContainer) inputContainer.style.display = 'flex';
}

function showChatMobile() {
    if (!isMobile()) return;
    document.querySelector(".chat-sidebar").classList.remove("mobile-show-sidebar");
    document.querySelector(".chat-main").classList.add("mobile-show-chat");
}

function applyLayoutForViewport() {
    const sidebar = document.querySelector(".chat-sidebar");
    const main = document.querySelector(".chat-main");

    if (isMobile()) {
        if (!currentChatId) {
            // No chat selected: show list
            sidebar.classList.add("mobile-show-sidebar");
            main.classList.remove("mobile-show-chat");
        } else {
            // Chat selected: show chat
            sidebar.classList.remove("mobile-show-sidebar");
            main.classList.add("mobile-show-chat");
        }
    } else {
        sidebar.classList.remove("mobile-show-sidebar");
        main.classList.remove("mobile-show-chat");
        main.style.display = "flex";
    }
}


window.addEventListener("resize", applyLayoutForViewport);
document.addEventListener("DOMContentLoaded", applyLayoutForViewport);

function initKeyboardHandling() {
    let keyboardHeight = 0;
    
    if (window.visualViewport) {
        const inputContainer = document.getElementById('chatInputContainer');
        
        window.visualViewport.addEventListener('resize', () => {
            if (!currentChatId || !inputContainer) return;
            
            const visibleHeight = window.visualViewport.height;
            const fullHeight = window.innerHeight;
            keyboardHeight = fullHeight - visibleHeight;
            
            const bottomOffset = keyboardHeight > 50 ? keyboardHeight : 'env(safe-area-inset-bottom)';
            inputContainer.style.bottom = typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset;

            setTimeout(() => {
                messagesElement.scrollTop = messagesElement.scrollHeight;
            }, 50);
        });
        
        window.visualViewport.addEventListener('scroll', () => {
            messagesElement.scrollTop = messagesElement.scrollHeight;
        });
    }

    if ('virtualKeyboard' in navigator && currentChatId) {
        navigator.virtualKeyboard.addEventListener('geometrychange', (e) => {
            const inputContainer = document.getElementById('chatInputContainer');
            if (!inputContainer) return;
            
            keyboardHeight = e.target.boundingRect.height;
            inputContainer.style.bottom = `${keyboardHeight}px`;
            
            setTimeout(() => {
                messagesElement.scrollTop = messagesElement.scrollHeight;
            }, 50);
        });
    }
    
    let initialHeight = window.innerHeight;
    messageInputElement.addEventListener('focus', () => {
        initialHeight = window.innerHeight;
        setTimeout(() => {
            messagesElement.scrollTop = messagesElement.scrollHeight;
        }, 300);
    });
    
    window.addEventListener('resize', () => {
        if (!window.visualViewport) {
            const inputContainer = document.getElementById('chatInputContainer');
            const currentHeight = window.innerHeight;
            const kbHeight = initialHeight - currentHeight;
            
            if (kbHeight > 100) {
                inputContainer.style.bottom = `${kbHeight}px`;
            } else {
                inputContainer.style.bottom = 'env(safe-area-inset-bottom)';
            }
            initialHeight = currentHeight;
            
            messagesElement.scrollTop = messagesElement.scrollHeight;
        }
    });
}


async function createNewConversation(participantId) {
    const result = await apiCall("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantId })
    });

    if (result.ok) {
        const newChatId = result.data.conversationId;

        subscribeToNewChat(newChatId);

        closeModal();
        await getConversations();
        renderChatList();

        selectChat(newChatId);
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
    // Clean up old subscriptions
    pusher.allChannels().forEach(channel => {
        pusher.unsubscribe(channel.name);
    });

    const conversationChannel = pusher.subscribe('conversation');
    conversationChannel.bind('new-conversation', async (data) => {
        await storeNewConversation(data.message.conversationId);
        subscribeToNewChat(data.message.conversationId);
    });

    chats.forEach(chat => {
        subscribeToChat(chat.id);
    });
}

function subscribeToChat(chatId) {
    if (!validateChatId(chatId, "subscribeToChat")) return;

    const channelName = `conversation-${chatId}`;

    // Don't subscribe twice
    if (pusher.channel(channelName)) {
        return;
    }

    const channel = pusher.subscribe(channelName);

    channel.bind('new-message', (data) => {
        appendMessageLocally(chatId, data.message);
    });
}

function subscribeToNewChat(chatId) {
    subscribeToChat(chatId);
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
            return;
        }
        searchUsers(query);
    };

    document.getElementById("backButton").onclick = () => {
        currentChatId = null;
        if (isMobile()) {
            showChatListMobile();
            chatContainerElement.style.display = "none";
            noChatSelectedElement.style.display = "none";
        } else {
            noChatSelectedElement.style.display = "flex";
            chatContainerElement.style.display = "none";

        }
        renderChatList();
    };

    document.getElementById("sendButton").onclick = sendMessage;

    // document.getElementById("refreshButton").onclick = async () => {
    //     await initialSync();
    // };

    messageInputElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

async function init() {
    await initDB();
    await initialSync();

    renderChatList();

    initEventListeners();
    if (isMobile()) {
        initKeyboardHandling();
    }
}

document.addEventListener("DOMContentLoaded", init);
