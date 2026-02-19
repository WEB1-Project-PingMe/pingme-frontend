const BACKEND_URL = "https://pingme-backend-nu.vercel.app";

let currentLocationId = null;

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
            window.news.href = "../auth/login.html";
            throw new Error("Session expired");
        }

        const data = await response.json();
        return { response, data, ok: response.ok };
    } catch (error) {
        console.error("API call failed:", error);
        return { error: error.message };
    }
}

function isMobile() {
    let output = window.innerWidth <= 768
    return output;
}

function showNewsListMobile() {
    if (!isMobile()) return;
    document.querySelector(".news-sidebar").classList.add("mobile-show-sidebar");
    document.querySelector(".news-main").classList.remove("mobile-show-news");
    if (inputContainer) inputContainer.style.display = "flex";
}

function showNewsMobile() {
    if (!isMobile()) return;
    document.querySelector(".news-sidebar").classList.remove("mobile-show-sidebar");
    document.querySelector(".news-main").classList.add("mobile-show-news");
}

function applyLayoutForViewport() {
    const sidebar = document.querySelector(".news-sidebar");
    const main = document.querySelector(".news-main");

    if (isMobile()) {
        if (!currentLocationId) {
            sidebar.classList.add("mobile-show-sidebar");
            main.classList.remove("mobile-show-news");
        } else {
            sidebar.classList.remove("mobile-show-sidebar");
            main.classList.add("mobile-show-news");
        }
    } else {
        sidebar.classList.remove("mobile-show-sidebar");
        main.classList.remove("mobile-show-news");
        main.style.display = "flex";
    }
}


window.addEventListener("resize", applyLayoutForViewport);
document.addEventListener("DOMContentLoaded", applyLayoutForViewport);


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
                    window.news.href = "../auth/login.html";
                }
            });
    } catch (error) {
        window.news.href = "../auth/login.html";
    }
    // await initDB();
    document.getElementById("authOverlay").style.display = "none";

}

document.addEventListener("DOMContentLoaded", init);