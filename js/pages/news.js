const BACKEND_URL = "https://pingme-backend-nu.vercel.app";
const DB_NAME = "PingMeNewsDB";
let db = null;
const searchesStoreName = "searches";
const newsStoreName = "newsData";

let currentSearchId = null;
let currentSearchData = null;
let currentNewsData = null;

async function initDB() {
    console.log("initDB");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            db = e.target.result;
            
            if (!db.objectStoreNames.contains(searchesStoreName)) {
                const searchesStore = db.createObjectStore(searchesStoreName, { 
                    keyPath: "id", 
                    autoIncrement: true 
                });
                searchesStore.createIndex("name", "name", { unique: false });
            }
            
            if (!db.objectStoreNames.contains(newsStoreName)) {
                const newsStore = db.createObjectStore(newsStoreName, { 
                    keyPath: "searchId" 
                });
                newsStore.createIndex("searchId", "searchId", { unique: true });
                newsStore.createIndex("updatedAt", "updatedAt");
            }
        };
    });
}

function isMobile() {
    return window.innerWidth <= 768;
}

function showSearchListMobile() {
    if (!isMobile()) return;
    document.querySelector(".location-sidebar").classList.add("mobile-show-sidebar");
    document.querySelector(".location-main").classList.remove("mobile-show-location");
}

function showSearchMobile() {
    if (!isMobile()) return;
    document.querySelector(".location-sidebar").classList.remove("mobile-show-sidebar");
    document.querySelector(".location-main").classList.add("mobile-show-location");
}

function applyLayoutForViewport() {
    const sidebar = document.querySelector(".location-sidebar");
    const main = document.querySelector(".location-main");

    if (isMobile()) {
        if (!currentSearchId) {
            sidebar.classList.add("mobile-show-sidebar");
            main.classList.remove("mobile-show-location");
        } else {
            sidebar.classList.remove("mobile-show-sidebar");
            main.classList.add("mobile-show-location");
        }
    } else {
        sidebar.classList.remove("mobile-show-sidebar");
        main.classList.remove("mobile-show-location");
        main.style.display = "flex";
    }
}

async function getAllSearches() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        
        if (!db.objectStoreNames.contains(searchesStoreName)) {
            console.log("Searches store not found, returning empty");
            return resolve([]);
        }

        const transaction = db.transaction([searchesStoreName], "readonly");
        const store = transaction.objectStore(searchesStoreName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function addSearch(name, query = name) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        const transaction = db.transaction([searchesStoreName], "readwrite");
        const store = transaction.objectStore(searchesStoreName);
        
        const search = {
            name,
            query,
            createdAt: new Date().toISOString()
        };

        const request = store.add(search);

        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function deleteSearch(id) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(false);
        
        const transaction = db.transaction([searchesStoreName], "readwrite");
        const store = transaction.objectStore(searchesStoreName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function saveNewsData(searchId, newsData) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        const transaction = db.transaction([newsStoreName], "readwrite");
        const store = transaction.objectStore(newsStoreName);
        
        const newsRecord = {
            searchId,
            articles: newsData,
            totalResults: newsData.totalResults || 0,
            updatedAt: new Date().toISOString()
        };

        const request = store.put(newsRecord);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadNewsFromDB(searchId) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(newsStoreName)) {
            return resolve(null);
        }

        const transaction = db.transaction([newsStoreName], "readonly");
        const store = transaction.objectStore(newsStoreName);
        const request = store.get(searchId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadSearchNews(searchId) {
    const cachedData = await loadNewsFromDB(searchId);
    
    if (cachedData) {
        currentNewsData = cachedData;
        updateLastUpdated(cachedData.updatedAt);
        displayArticles();
        //displaySearchInfo();
        return true;
    }
    
    return false;
}

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

async function loadNews(searchQuery, searchId, saveToDB = true) {
    try {
        const result = await apiCall(`/news/everything?q=${encodeURIComponent(searchQuery)}`);
        if (result.ok && result.data.articles) {
            currentNewsData = result.data;
            if (saveToDB) {
                saveNewsData(searchId, result.data);
            }
            displayArticles();
            //displaySearchInfo();
        }
    } catch (error) {
        console.error("News error:", error);
    }
}

function displayArticles() {
    if (!currentNewsData?.articles) return;

    const articlesList = document.getElementById("articlesList");
    articlesList.innerHTML = "";

    currentNewsData.articles.slice(0, 10).forEach(article => {
        const item = document.createElement("div");
        item.className = "article-item";
        item.innerHTML = `
            <div class="article-image">
                <img src="${article.urlToImage || ''}" alt="${article.title}" onerror="this.style.display='none'">
            </div>
            <div class="article-content">
                <h4 class="article-title">${article.title}</h4>
                <p class="article-source">${article.source.name} • ${new Date(article.publishedAt).toLocaleDateString()}</p>
                <p class="article-description">${article.description || ''}</p>
                <a href="${article.url}" target="_blank" class="read-more">Read more</a>
            </div>
        `;
        articlesList.appendChild(item);
    });
}

function displaySearchInfo() {
    if (!currentNewsData) return;

    const searchInfo = document.getElementById("searchInfo");
    searchInfo.innerHTML = `
        <div class="info-item">
            <span class="info-label">Total Results</span>
            <span class="info-value">${currentNewsData.totalResults || 0}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Articles Shown</span>
            <span class="info-value">${currentNewsData.articles?.length || 0}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value">${currentNewsData.status || 'ok'}</span>
        </div>
    `;
}

function updateLastUpdated(timestamp) {
    const updateTime = new Date(timestamp);
    document.getElementById("lastUpdated").textContent = `Updated ${updateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`;
}

async function loadSearches() {
    try {
        const searches = await getAllSearches();
        const searchList = document.getElementById("searchList");
        searchList.innerHTML = "";

        if (searches.length === 0) {
            searchList.innerHTML = `
                <div class="empty-state">
                    <p>No searches added yet</p>
                    <p>Click + to add your first search</p>
                </div>
            `;
            return;
        }

        searches.forEach(search => {
            const item = document.createElement("div");
            item.className = `location-item ${currentSearchId === search.id ? 'active' : ''}`;
            item.dataset.searchId = search.id;
            item.innerHTML = `
                <div class="location-avatar">${search.name.charAt(0).toUpperCase()}</div>
                <div class="location-preview">
                    <div class="location-name">${search.name}</div>
                </div>
                <button class="delete-location" data-id="${search.id}">×</button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains("delete-location")) {
                    selectSearch(search.id, search.name, search.query);
                }
            });
            
            searchList.appendChild(item);
        });

        document.querySelectorAll(".delete-location").forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const id = parseInt(e.target.dataset.id);
                if (confirm("Delete this search?")) {
                    await deleteSearch(id);
                    await loadSearches();
                    if (currentSearchId === id) {
                        showSearchListMobile();
                        currentSearchId = null;
                        document.getElementById("noSearchSelected").style.display = "flex";
                        document.getElementById("newsContainer").style.display = "none";
                    }
                }
            };
        });
    } catch (error) {
        console.error("Failed to load searches:", error);
    }
}

async function selectSearch(id, name, query) {
    currentSearchId = id;
    currentSearchData = { id, name, query };
    
    document.getElementById("searchTitle").textContent = name;
    document.getElementById("noSearchSelected").style.display = "none";
    document.getElementById("newsContainer").style.display = "flex";
    
    showSearchMobile();
    applyLayoutForViewport();
    
    const hasCachedData = await loadSearchNews(id);
    
    if (!hasCachedData) {
        updateLastUpdated(Date.now());
        await loadNews(query, id, true);
    }
    
    document.querySelectorAll(".location-item").forEach(item => item.classList.remove("active"));
    document.querySelector(`[data-search-id="${id}"]`)?.classList.add("active");
}

function closeModal() {
    document.getElementById("newSearchModal").style.display = "none";
    document.getElementById("searchInput").value = "";
    document.getElementById("saveSearchBtn").disabled = true;
}

async function init() {
    document.getElementById("authOverlay").style.display = "flex";

    try {
        const token = localStorage.getItem("sessionToken");
        const response = await fetch(`${BACKEND_URL}/auth/login`, {
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` })
            }
        });
        const data = await response.json();
        
        if (!data.loggedIn && response.status !== 200) {
            window.location.href = "../auth/login.html";
            return;
        }
    } catch (error) {
        window.location.href = "../auth/login.html";
        return;
    }

    document.getElementById("authOverlay").style.display = "none";
    await loadSearches();
    applyLayoutForViewport();
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initDB();
    } catch (error) {
        console.error("Database initialization failed:", error);
    }

    document.getElementById("newSearchButton").onclick = () => {
        document.getElementById("newSearchModal").style.display = "flex";
    };

    document.getElementById("closeModal").onclick = closeModal;
    document.getElementById("cancelSearchBtn").onclick = closeModal;
    
    document.getElementById("searchInput").oninput = (e) => {
        document.getElementById("saveSearchBtn").disabled = !e.target.value.trim();
    };

    document.getElementById("saveSearchBtn").onclick = async () => {
        const name = document.getElementById("searchInput").value.trim();
        if (name) {
            try {
                await addSearch(name);
                await loadSearches();
                closeModal();
                const searches = await getAllSearches();
                const newSearch = searches[searches.length - 1];
                if (newSearch) {
                    selectSearch(newSearch.id, newSearch.name, newSearch.query);
                }
            } catch (error) {
                console.error("Failed to save search:", error);
                alert("Failed to save search");
            }
        }
    };

    document.getElementById("backButton").onclick = showSearchListMobile;
    
    document.getElementById("refreshButton").onclick = async () => {
        if (currentSearchData && !document.getElementById("refreshButton").disabled) {
            document.getElementById("refreshButton").disabled = true;
            await loadNews(currentSearchData.query, currentSearchData.id, true);
            updateLastUpdated(Date.now());
            document.getElementById("refreshButton").disabled = false;
        }
    };

    document.getElementById("newSearchModal").onclick = (e) => {
        if (e.target.classList.contains("modal-overlay")) {
            closeModal();
        }
    };

    init();
});

window.addEventListener("resize", applyLayoutForViewport);
