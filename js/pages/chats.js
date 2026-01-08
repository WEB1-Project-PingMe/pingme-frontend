const BACKEND_URL = "https://pingme-backend-nu.vercel.app";

async function apiCall(url, options = {}) {
    try {
        const response = await fetch(BACKEND_URL + url, {
            headers: { "Content-Type": "application/json", ...options.headers },
            ...options
        });
        const data = await response.json();
        return { response, data, ok: response.ok };
    } catch (error) {
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