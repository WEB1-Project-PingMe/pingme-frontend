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
const modalTitleElement = document.getElementById("modalTitle");
const directContent = document.getElementById("directContent");
const groupContent = document.getElementById("groupContent");
const groupNameInput = document.getElementById("groupNameInput");
const groupMemberSearch = document.getElementById("groupMemberSearch");
const groupMemberList = document.getElementById("groupMemberList");
const selectedMembersElement = document.getElementById("selectedMembers");
const createChatButton = document.getElementById("createChatButton");

let selectedGroupMembers = [];
let currentModalType = 'direct';

let users = [];
let chats = [];
let currentChatId = null;
let currentChatType = null;
let db;
let pusher = new Pusher("d8e5b208992682efa26f", {
    cluster: "eu"
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
            window.location.href = "../auth/login.html";
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

            if (!db.objectStoreNames.contains('usernames')) {
                const usernamesStore = db.createObjectStore('usernames', { keyPath: "userId" });
                usernamesStore.createIndex("name", "name", { unique: false });
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

async function getChats() {
    chats = [];
    const [convResult, groupResult] = await Promise.all([
        apiCall("/conversations"),
        apiCall("/groups")
    ]);

    if (convResult.ok && convResult.data.success) {
        const conversationChats = (convResult.data.conversations || []).map(conv => ({
            id: conv._id,
            name: conv.participants[0]?.name || conv.participants[0]?.userTag || "Unknown Chat",
            timestamp: conv.lastMessageAt || conv.updatedAt,
            lastMessageText: conv.lastMessageText,
            participants: conv.participants,
            type: "conversation"
        }));
        chats = chats.concat(conversationChats);
    }

    if (groupResult.ok && groupResult.data) {
        const groupChats = (groupResult.data || []).map(group => ({
            id: group._id,
            name: group.name || "Unknown Group",
            timestamp: group.lastMessageAt || group.updatedAt,
            lastMessageText: group.lastMessageText,
            members: group.memberIds,
            admins: group.adminIds,
            type: "group"
        }));
        chats = chats.concat(groupChats);
    }
    storeChats();
    return chats;
}

async function storeNewChat(chatId, type) {
    if (type === "conversation") {
        const result = await apiCall(`/conversations/conversation/${chatId}`);
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
    } else {

    }
}

async function getConversationMessages(conversationId, limit = 50, before = null) {
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

async function sendConversationMessageToRemote(conversationId, text) {
    if (!validateChatId(conversationId, "sendMessage")) return false;

    const senderId = localStorage.getItem("currentUserId");
    const result = await apiCall("/conversations/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId, senderId, text })
    });
    return result.ok;
}

async function getGroupMessages(groupId, limit = 50, before = null) {
    if (!validateChatId(groupId, "getMessages")) return [];

    const params = new URLSearchParams();
    if (limit) params.append("limit", limit);
    if (before) params.append("before", before);

    const url = `/groups/${groupId}/messages${params.toString() ? `?${params}` : ''}`;
    const result = await apiCall(url);

    if (result.ok) {
        storeMessagesForChat(groupId, result.data || []);
        return result.data || [];
    }
    return [];
}

async function sendGroupMessageToRemote(groupId, text) {
    if (!validateChatId(groupId, "sendMessage")) return false;

    const senderId = localStorage.getItem("currentUserId");
    const result = await apiCall(`/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify({
            senderId,
            text
        })
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

async function populateUsernames(messages) {
    const uniqueSenderIds = [...new Set(messages.map(msg => msg.senderId))];
    const currentUserId = localStorage.getItem("currentUserId");

    for (const userId of uniqueSenderIds) {
        if (userId === currentUserId) continue;

        const existing = await new Promise(resolve => {
            const tx = db.transaction("usernames", "readonly");
            const store = tx.objectStore("usernames");
            const request = store.get(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });

        if (!existing) {
            const result = await apiCall(`/users/${userId}`);

            if (result.ok && result.data?.user) {
                await new Promise(resolve => {
                    const tx = db.transaction("usernames", "readwrite");
                    const store = tx.objectStore("usernames");
                    store.put({
                        userId,
                        name: result.data.user.name,
                        tag: result.data.user.tag
                    });
                    tx.oncomplete = resolve;
                    tx.onerror = () => resolve();
                });
            } else {
                await new Promise(resolve => {
                    const tx = db.transaction("usernames", "readwrite");
                    const store = tx.objectStore("usernames");
                    store.put({ userId, name: "User" });
                    tx.oncomplete = resolve;
                });
            }
        }
    }
}

async function initialSync() {
    await clearLocalData();

    await getChats();

    for (const chat of chats) {
        if (chat.type === "group") {
            await getGroupMessages(chat.id, 50); // Only recent 50 messages
        } else {
            await getConversationMessages(chat.id, 50); // Only recent 50 messages
        }

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
        await appendNewMessage(message, currentChatType);
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
    const sortedChats = chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    chatListElement.innerHTML = sortedChats.map(chat => {
        const lastMsgTime = chat.timestamp;
        const timeStr = lastMsgTime
            ? new Date(lastMsgTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            })
            : "Never";

        return `
            <div class="chat-item ${currentChatId === chat.id ? "active" : ""}" data-chat-id="${chat.id}">
                <div class="chat-avatar">${chat.name.charAt(0).toUpperCase()}</div>
                <div class="chat-preview">
                    <div class="chat-name">${chat.name}</div>
                    <div class="chat-last-message">${chat.lastMessageText ? `${timeStr}: ${chat.lastMessageText}` : ""}</div>
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
    currentChatType = chats.find(item => item.id === chatId).type;
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

    if (currentChatType === "group") {
        await populateUsernames(messages);
    }

    renderMessages(messages, currentChatType);
}

async function renderMessages(messages, chatType) {
    messages = [...messages].reverse();

    const usernameCache = new Map();
    if (chatType === "group") {
        const uniqueSenderIds = [...new Set(
            messages
                .filter(msg => msg.senderId !== localStorage.getItem("currentUserId"))
                .map(msg => msg.senderId)
        )];

        const tx = db.transaction("usernames", "readonly");
        const store = tx.objectStore("usernames");

        for (const userId of uniqueSenderIds) {
            const username = await new Promise(resolve => {
                const request = store.get(userId);
                request.onsuccess = () => resolve(request.result?.name || "Unknown");
            });
            usernameCache.set(userId, username);
        }
    }

    messagesElement.innerHTML = messages.slice(0, 50).map(msg => {
        const time = new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", hour12: false
        });
        const isSent = msg.senderId === localStorage.getItem("currentUserId");
        const showSenderName = chatType === "group" && !isSent;
        const senderName = usernameCache.get(msg.senderId) || "Unknown";

        return `
            <div class="message-wrapper ${isSent ? "sent-wrapper" : "received-wrapper"}">
                ${showSenderName ? `<div class="sender-name">${escapeHtml(senderName)}</div>` : ''}
                <div class="message ${isSent ? "sent" : "received"}">
                    ${escapeHtml(msg.text)}
                    <div class="message-time">${time}</div>
                </div>
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

async function appendNewMessage(msg, chatType) {
    const time = formatTime(msg.createdAt || msg.timestamp);
    const isSent = msg.senderId === localStorage.getItem("currentUserId");

    let senderName = "";

    if (chatType === "group" && !isSent && db) {
        try {
            const tx = db.transaction("usernames", "readonly");
            const store = tx.objectStore("usernames");
            senderName = await new Promise((resolve) => {
                const request = store.get(msg.senderId);
                request.onsuccess = () => resolve(request.result?.name || "Unknown");
                request.onerror = () => resolve("Unknown");
            });
        } catch (error) {
            console.warn("Could not fetch username:", error);
            const messages = await loadMessagesForChat(currentChatId);
            await populateUsernames(messages);
            const tx = db.transaction("usernames", "readonly");
            const store = tx.objectStore("usernames");
            senderName = await new Promise((resolve) => {
                const request = store.get(msg.senderId);
                request.onsuccess = () => resolve(request.result?.name || "Unknown");
                request.onerror = () => resolve("Unknown");
            });
        }
    }

    const msgHtml = `
        <div class="message-wrapper ${isSent ? "sent-wrapper" : "received-wrapper"}">
            ${chatType === "group" && !isSent
            ? `<div class="sender-name">${escapeHtml(senderName)}</div>`
            : ""}
            <div class="message ${isSent ? "sent" : "received"}">
                ${escapeHtml(msg.text)}
                <div class="message-time">${time}</div>
            </div>
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
    let success = false;
    if (currentChatType === "conversation") {
        success = await sendConversationMessageToRemote(currentChatId, text);
    } else {
        success = await sendGroupMessageToRemote(currentChatId, text);
    }

    messageInputElement.value = "";

    if (!success) {
        alert("Failed to send message");
    }

    messageInputElement.disabled = false;
    sendButton.disabled = false;
    //sendButton.textContent = "Send";
}

function switchChatType(type) {
    currentModalType = type;
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
    document.querySelector(`[data-type="${type}"]`).classList.add('active');

    if (type === 'direct') {
        modalTitleElement.textContent = 'New Chat';
        directContent.style.display = 'block';
        groupContent.style.display = 'none';
        participantSearchElement.focus();
    } else {
        modalTitleElement.textContent = 'New Group';
        directContent.style.display = 'none';
        groupContent.style.display = 'block';
        groupNameInput.focus();
    }
    updateCreateButton();
}

async function searchUsers(query) {
    if (query.length < 3) {
        users = [];
        renderUserList();
        return;
    }
    const result = await apiCall(`/users/search/${encodeURIComponent(query)}`);
    if (result.ok) {
        users = result.data.users || [];
        renderUserList();
    }
}

async function searchGroupMembers(query) {
    if (query.length < 3) {
        users = [];
        renderGroupMemberList();
        return;
    }
    const result = await apiCall(`/users/search/${encodeURIComponent(query)}`);
    if (result.ok) {
        const currentUserId = localStorage.getItem("currentUserId");
        users = (result.data.users || []).filter(u =>
            u._id !== currentUserId && !selectedGroupMembers.includes(u._id)
        );
        renderGroupMemberList();
    }
    if (result.ok) {
        users = result.data.users || [];
        renderGroupMemberList();
    }
}

function renderUserList() {
    userListElement.innerHTML = users.map(user => `
        <div class="user-item" data-user-id="${user._id}">
            <div class="user-avatar">${user.name?.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <h4>${user.name || user.email}</h4>
                <p>#${user.tag}</p>
            </div>
        </div>
    `).join("");
    document.querySelectorAll("#userList .user-item").forEach(item => {
        item.onclick = () => createNewConversation(item.dataset.userId);
    });
    document.querySelector(".no-users").style.display = users.length === 0 ? "block" : "none";
}

function renderGroupMemberList() {
    groupMemberList.innerHTML = users.map(user => `
        <div class="user-item" data-user-id="${user._id}">
            <div class="user-avatar">${user.name?.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <h4>${user.name || user.email}</h4>
                <p>#${user.tag}</p>
            </div>
        </div>
    `).join("");

    document.querySelectorAll("#groupMemberList .user-item").forEach(item => {
        item.onclick = () => toggleGroupMember(item.dataset.userId, item);
    });
    document.querySelector(".no-users").style.display = users.length === 0 ? "block" : "none";
}

function toggleGroupMember(userId, element) {
    const index = selectedGroupMembers.indexOf(userId);
    if (index > -1) {
        selectedGroupMembers.splice(index, 1);
        element.classList.remove('selected');
    } else {
        selectedGroupMembers.push(userId);
        element.classList.add('selected');
    }
    renderSelectedMembers();
    updateCreateButton();
}

function renderSelectedMembers() {
    selectedMembersElement.innerHTML = selectedGroupMembers.map(id => {
        const user = users.find(u => u._id === id) || { name: 'Loading...' };
        return `
            <span class="selected-member">
                ${user.name}
                <span class="remove-member" data-id="${id}">×</span>
            </span>
        `;
    }).join("");

    // Add remove handlers
    selectedMembersElement.querySelectorAll('.remove-member').forEach(span => {
        span.onclick = (e) => {
            e.stopPropagation();
            const userId = span.dataset.id;
            selectedGroupMembers = selectedGroupMembers.filter(id => id !== userId);
            renderSelectedMembers();
            updateCreateButton();
        };
    });
}

function updateCreateButton() {
    const hasContent = currentModalType === 'direct' ||
        (groupNameInput.value.trim() && selectedGroupMembers.length >= 1);
    createChatButton.disabled = !hasContent;
}

async function createChat() {
    if (currentModalType === 'direct') {
        // Single user already handled by renderUserList onclick
        return;
    } else {
        await createNewGroup();
    }
}

function openModal() {
    newChatModalElement.style.display = "flex";
    switchChatType('direct'); // Default to 1:1
    participantSearchElement.value = "";
    groupNameInput.value = "";
    selectedGroupMembers = [];
    users = [];
    renderUserList();
}

function closeModal() {
    newChatModalElement.style.display = "none";
    participantSearchElement.value = "";
    groupNameInput.value = "";
    groupMemberSearch.value = "";
    selectedGroupMembers = [];
    users = [];
    createChatButton.disabled = true;
    renderUserList();
}


function isMobile() {
    let output = window.innerWidth <= 768
    return output;
}

function showChatListMobile() {
    if (!isMobile()) return;
    document.querySelector(".chat-sidebar").classList.add("mobile-show-sidebar");
    document.querySelector(".chat-main").classList.remove("mobile-show-chat");
    const inputContainer = document.getElementById("chatInputContainer");
    if (inputContainer) inputContainer.style.display = "flex";
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
        const inputContainer = document.getElementById("chatInputContainer");

        window.visualViewport.addEventListener("resize", () => {
            if (!currentChatId || !inputContainer) return;

            const visibleHeight = window.visualViewport.height;
            const fullHeight = window.innerHeight;
            keyboardHeight = fullHeight - visibleHeight;

            const bottomOffset = keyboardHeight > 50 ? keyboardHeight : "env(safe-area-inset-bottom)";
            inputContainer.style.bottom = typeof bottomOffset === "number" ? `${bottomOffset}px` : bottomOffset;

            setTimeout(() => {
                messagesElement.scrollTop = messagesElement.scrollHeight;
            }, 50);
        });

        window.visualViewport.addEventListener("scroll", () => {
            messagesElement.scrollTop = messagesElement.scrollHeight;
        });
    }

    if ("virtualKeyboard" in navigator && currentChatId) {
        navigator.virtualKeyboard.addEventListener("geometrychange", (e) => {
            const inputContainer = document.getElementById("chatInputContainer");
            if (!inputContainer) return;

            keyboardHeight = e.target.boundingRect.height;
            inputContainer.style.bottom = `${keyboardHeight}px`;

            setTimeout(() => {
                messagesElement.scrollTop = messagesElement.scrollHeight;
            }, 50);
        });
    }

    let initialHeight = window.innerHeight;
    messageInputElement.addEventListener("focus", () => {
        initialHeight = window.innerHeight;
        setTimeout(() => {
            messagesElement.scrollTop = messagesElement.scrollHeight;
        }, 300);
    });

    window.addEventListener("resize", () => {
        if (!window.visualViewport) {
            const inputContainer = document.getElementById("chatInputContainer");
            const currentHeight = window.innerHeight;
            const kbHeight = initialHeight - currentHeight;

            if (kbHeight > 100) {
                inputContainer.style.bottom = `${kbHeight}px`;
            } else {
                inputContainer.style.bottom = "env(safe-area-inset-bottom)";
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
        await getChats();
        renderChatList();

        selectChat(newChatId);
    } else {
        alert(result.data?.error || "Failed to create chat");
    }
}

async function createNewGroup() {
    const name = groupNameInput.value.trim();
    if (!name || selectedGroupMembers.length < 1) return;

    // Creator (current user) becomes admin
    const currentUserId = localStorage.getItem("currentUserId");
    const adminIds = [currentUserId];

    selectedGroupMembers.push(currentUserId);

    const result = await apiCall("/groups", {
        method: "POST",
        body: JSON.stringify({
            name: name,
            adminIds: adminIds,
            memberIds: selectedGroupMembers
        })
    });

    if (result.ok && result.data) {
        const newGroupId = result.data._Id;
        closeModal();
        await getChats();
        renderChatList();
        selectChat(newGroupId);
    } else {
        alert(result.data?.message || result.error || "Failed to create group");
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

    const conversationChannel = pusher.subscribe("chat");
    conversationChannel.bind("new-chat", async (data) => {
        await storeNewConversation(data.message.chatId);
        subscribeToNewChat(data.message.chatId);
    });

    chats.forEach(chat => {
        subscribeToChat(chat.id);
    });
}

function subscribeToChat(chatId) {
    if (!validateChatId(chatId, "subscribeToChat")) return;

    const channelName = `chat-${chatId}`;

    // Don't subscribe twice
    if (pusher.channel(channelName)) {
        return;
    }

    const channel = pusher.subscribe(channelName);

    channel.bind("new-message", (data) => {
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
    createChatButton.onclick = createChat;

    newChatModalElement.onclick = (e) => {
        if (e.target === newChatModalElement) closeModal();
    };

    document.querySelectorAll(".type-option").forEach(option => {
        option.onclick = () => switchChatType(option.dataset.type);
    });

    if (participantSearchElement) {
        participantSearchElement.oninput = (e) => {
            const query = e.target.value.trim();
            if (currentModalType === "direct") {
                if (query.length < 3) {
                    users = [];
                    renderUserList();
                    return;
                }
                searchUsers(query);
            }
        };
    }

    if (groupMemberSearch) {
        groupMemberSearch.oninput = (e) => {
            const query = e.target.value.trim();
            searchGroupMembers(query);
        };
    }

    if (groupNameInput) {
        groupNameInput.oninput = updateCreateButton;
    }

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

    messageInputElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}


async function init() {
    const token = localStorage.getItem("sessionToken");
    try {
        await fetch(`${BACKEND_URL}/auth/login`, {
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` })
            }
        })
            .then(res => res.json())
            .then(data => {
                if (!data.loggedIn) {
                    window.location.href = "../auth/login.html";
                }
            });
    } catch (error) {
        window.location.href = "../auth/login.html";
    }
    await initDB();
    await loadChats();
    renderChatList();
    document.getElementById("authOverlay").style.display = "none";

    await initialSync();

    renderChatList();

    initEventListeners();
    if (isMobile()) {
        initKeyboardHandling();
    }
}

document.addEventListener("DOMContentLoaded", init);
