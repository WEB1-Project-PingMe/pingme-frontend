const BACKEND_URL = "https://pingme-backend-nu.vercel.app";

async function apiCall(endpoint, options = {}) {
    try {
        const token = localStorage.getItem("sessionToken");
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` }),
                ...options.headers,
            },
            ...options,
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

async function loadProfile() {
    const result = await apiCall("/auth/account");

    if (result.error) {
        console.error("Failed to load profile:", result.error);
        document.getElementById("username").textContent = "Error loading";
        document.getElementById("usertag").textContent = "Error loading";
        document.getElementById("email").textContent = "Error loading";
        return;
    }

    document.getElementById("username").textContent = result.data.name || "No username";
    document.getElementById("usertag").textContent = result.data.tag || "#notag";
    document.getElementById("email").textContent = result.data.email || "No email";
    document.getElementById("avatar").textContent = result.data.name.charAt(0).toUpperCase()
}

async function init() {
    try {
        const token = localStorage.getItem("sessionToken");
        const authResult = await fetch(`${BACKEND_URL}/auth/login`, {
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` })
            }
        });

        const authData = await authResult.json();
        if (!authData.loggedIn) {
            window.location.href = "../auth/login.html";
            return;
        }
    } catch (error) {
        window.location.href = "../auth/login.html";
        return;
    }
    await loadProfile();

    document.getElementById("authOverlay").style.display = "none";

}

async function deleteAllDatabases() {
    const dbs = await window.indexedDB.databases();
    dbs.forEach(db => {
        const request = window.indexedDB.deleteDatabase(db.name);
        request.onsuccess = () => console.log(`Deleted ${db.name}`);
        request.onerror = () => console.error("Delete failed:", request.error);
    });
}

async function deleteAccount() {
    const confirmed = confirm("Are you sure you want to permanently delete your account? This action cannot be undone.");
    if (!confirmed) return;

    try {
        const result = await apiCall("/auth/account", {
            method: "DELETE",
        });

        if (result.ok && result.data?.message === "deleted successfully") {
            localStorage.clear();
            alert("Account deleted successfully. Goodbye!");
            window.location.href = "../auth/register.html";
        } else if (result.data?.message === "user doesn't exist") {
            alert("User not found. Logging out.");
            localStorage.removeItem("sessionToken");
            window.location.href = "../auth/register.html";
        } else if (result.error) {
            throw new Error(result.error);
        } else {
            throw new Error(result.data?.error || "Delete failed");
        }
    } catch (error) {
        console.error("Delete error:", error);
        alert("Error deleting account: " + error.message);
    }
}

document.getElementById("deleteAccountBtn").addEventListener("click", async () => {
    const deleteBtn = document.getElementById("deleteAccountBtn");
    const loadingEl = document.getElementById("deleteLoading");

    deleteBtn.disabled = true;
    loadingEl.style.display = "flex";

    try {
        await deleteAccount();
    } finally {
        deleteBtn.disabled = false;
        loadingEl.style.display = "none";
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const editBtn = document.getElementById("editProfileBtn");
    if (editBtn) {
        editBtn.addEventListener("click", function () {
            localStorage.clear();
            deleteAllDatabases();
            window.location.href = "../auth/login.html";
        });
    }

    init();
});
