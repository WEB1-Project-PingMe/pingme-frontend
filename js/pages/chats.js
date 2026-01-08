const BACKEND_URL = "https://pingme-backend-nu.vercel.app";
const currentUserID = localStorage.getItem("currentUserID");
let currentConversationId = null;
const conversations = new Map();
const userCache = new Map();

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

async function createConversation() {
    const participantIds = JSON.parse(document.getElementById("participantIds").value || "[]");

    const result = await apiCall("/conversations", {
        method: "POST",
        body: JSON.stringify({ participantIds })
    });

    document.getElementById("createConvResult").textContent =
        result.ok ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`;

    if (result.ok && result.data.conversationId) {
        document.getElementById("convId").value = result.data.conversationId;
        document.getElementById("convIdPost").value = result.data.conversationId;
    }
}


async function getConversationMessages() {
    const convId = document.getElementById("convId").value;
    const limit = document.getElementById("convLimit").value;
    const before = document.getElementById("convBefore").value;

    let url = `/conversations/messages?conversationId=${convId}&limit=${limit}`;
    if (before) url += `&before=${before}`;

    const result = await apiCall(url);
    document.getElementById("convMessages").textContent =
        result.ok ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`;
}

async function postConversationMessage() {
    const convId = document.getElementById("convIdPost").value;
    const senderId = document.getElementById("senderIdPost").value;
    const text = document.getElementById("convText").value;

    const result = await apiCall("/conversations/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId: convId, senderId, text })
    });

    document.getElementById("convPostResult").textContent =
        result.ok ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`;
}

async function getGroupMessages() {
    const groupId = document.getElementById("groupId").value;
    const limit = document.getElementById("groupLimit").value;
    const before = document.getElementById("groupBefore").value;

    let url = `/groups/${groupId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;

    const result = await apiCall(url);
    document.getElementById("groupMessages").textContent =
        result.ok ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`;
}

async function postGroupMessage() {
    const groupId = document.getElementById("groupIdPost").value;
    const senderId = document.getElementById("groupSenderId").value;
    const text = document.getElementById("groupText").value;

    const result = await apiCall(`/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify({ senderId, text })
    });

    document.getElementById("groupPostResult").textContent =
        result.ok ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`;
}

async function getUserName(userId) {
    // Check cache first
    if (userCache.has(userId)) {
        return userCache.get(userId);
    }

    // API call to get user by ID
    const result = await apiCall(`/users/${userId}`);

    if (result.ok && result.data?.name) {
        userCache.set(userId, result.data.name);
        return result.data.name;
    }

    // Fallback
    return `User ${userId.slice(-6)}`;
}

async function loadConversations() {
    // const result = await apiCall(`/conversations?userId=${currentUserID}`);
    const result = await apiCall("/conversations");

    if (!result.ok || result.error) {
        console.error("Error loading conversations:", result.error);
        return;
    }

    const conversationsList = document.getElementById("conversations-list");
    conversationsList.innerHTML = "";

    // Load conversations with user names
    for (const conv of result.data) {
        conversations.set(conv._id, conv);

        // Get other participant"s name via API
        const otherParticipantId = conv.participantIds.find(id =>
            id.toString() !== currentUserID.toString()
        );
        const participantName = await getUserName(otherParticipantId);

        const div = document.createElement("div");
        div.className = "conversation-item";
        div.dataset.conversationId = conv._id;
        div.innerHTML = `
                <div class="participant-name">${participantName}</div>
                <div class="last-message">${conv.lastMessage || "No messages yet"}</div>
            `;
        div.addEventListener("click", () => selectConversation(conv._id));
        conversationsList.appendChild(div);
    }
}

async function getParticipantName(conversation) {
    const otherParticipantId = conversation.participantIds.find(id =>
        id.toString() !== currentUserID.toString()
    );
    return await getUserName(otherParticipantId);
}

async function selectConversation(conversationId) {
    currentConversationId = conversationId;

    document.querySelectorAll(".conversation-item").forEach(item => {
        item.classList.remove("active");
    });
    document.querySelector(`[data-conversation-id="${conversationId}"]`).classList.add("active");

    await loadMessages(conversationId);

    document.getElementById("message-input").disabled = false;
    document.getElementById("send-button").disabled = false;

    const conversation = conversations.get(conversationId);
    const participantName = await getParticipantName(conversation);
    document.getElementById("chat-header").innerHTML = `
            <h3>Chat with ${participantName}</h3>
        `;

    scrollToBottom();
}

async function loadMessages(conversationId) {
    const result = await apiCall(`/messages/${conversationId}`);

    if (!result.ok || result.error) {
        console.error("Error loading messages:", result.error);
        return;
    }

    const container = document.getElementById("messages-container");
    container.innerHTML = "";

    result.data.forEach(msg => {
        appendMessage(msg);
    });
}

function appendMessage(message) {
    const container = document.getElementById("messages-container");
    const div = document.createElement("div");
    div.className = `message ${message.senderId.toString() === currentUserID.toString() ? "sent" : "received"}`;

    const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    div.innerHTML = `
            <div class="message-content">
                ${message.text}
                <div class="message-time">${time}</div>
            </div>
        `;
    container.appendChild(div);
    scrollToBottom();
}

async function sendMessage() {
    const input = document.getElementById("message-input");
    const text = input.value.trim();

    if (!text || !currentConversationId) return;

    const result = await apiCall("/messages", {
        method: "POST",
        body: JSON.stringify({
            conversationId: currentConversationId,
            senderId: currentUserID,
            text: text
        })
    });

    if (result.ok) {
        input.value = "";
        await loadMessages(currentConversationId);
        await loadConversations();
    }
}

function scrollToBottom() {
    const container = document.getElementById("messages-container");
    container.scrollTop = container.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
    loadConversations();
    
    document.getElementById("message-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
    document.getElementById("send-button").addEventListener("click", sendMessage);
});