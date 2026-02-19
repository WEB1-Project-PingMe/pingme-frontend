const BACKEND_URL = "https://pingme-backend-nu.vercel.app";
const DB_NAME = "PingMeWeatherDB";
let db = null;
const locationsStoreName = "locations";
const weatherStoreName = "weatherData";

let currentLocationId = null;
let currentLocationData = null;
let currentWeatherData = null;
let forecastData = null;

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
            
            if (!db.objectStoreNames.contains(locationsStoreName)) {
                const locationsStore = db.createObjectStore(locationsStoreName, { 
                    keyPath: "id", 
                    autoIncrement: true 
                });
                locationsStore.createIndex("name", "name", { unique: false });
            }
            
            if (!db.objectStoreNames.contains(weatherStoreName)) {
                const weatherStore = db.createObjectStore(weatherStoreName, { 
                    keyPath: "locationId" 
                });
                weatherStore.createIndex("locationId", "locationId", { unique: true });
                weatherStore.createIndex("updatedAt", "updatedAt");
            }
        };
    });
}

function isMobile() {
    return window.innerWidth <= 768;
}

function showWeatherListMobile() {
    if (!isMobile()) return;
    document.querySelector(".location-sidebar").classList.add("mobile-show-sidebar");
    document.querySelector(".location-main").classList.remove("mobile-show-location");
}

function showWeatherMobile() {
    if (!isMobile()) return;
    document.querySelector(".location-sidebar").classList.remove("mobile-show-sidebar");
    document.querySelector(".location-main").classList.add("mobile-show-location");
}

function applyLayoutForViewport() {
    const sidebar = document.querySelector(".location-sidebar");
    const main = document.querySelector(".location-main");

    if (isMobile()) {
        if (!currentLocationId) {
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

async function getAllLocations() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        
        if (!db.objectStoreNames.contains(locationsStoreName)) {
            console.log("Locations store not found, returning empty");
            return resolve([]);
        }

        const transaction = db.transaction([locationsStoreName], "readonly");
        const store = transaction.objectStore(locationsStoreName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function addLocation(name, query = name) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        const transaction = db.transaction([locationsStoreName], "readwrite");
        const store = transaction.objectStore(locationsStoreName);
        
        const location = {
            name,
            query,
            createdAt: new Date().toISOString()
        };

        const request = store.add(location);

        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function deleteLocation(id) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(false);
        
        const transaction = db.transaction([locationsStoreName], "readwrite");
        const store = transaction.objectStore(locationsStoreName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function saveWeatherData(locationId, weatherData, forecastData) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        const transaction = db.transaction([weatherStoreName], "readwrite");
        const store = transaction.objectStore(weatherStoreName);
        
        const weatherRecord = {
            locationId,
            currentWeather: weatherData,
            forecast: forecastData,
            updatedAt: new Date().toISOString()
        };

        const request = store.put(weatherRecord);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadWeatherFromDB(locationId) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(weatherStoreName)) {
            return resolve(null);
        }

        const transaction = db.transaction([weatherStoreName], "readonly");
        const store = transaction.objectStore(weatherStoreName);
        const request = store.get(locationId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadLocationWeather(locationId) {
    const cachedData = await loadWeatherFromDB(locationId);
    
    if (cachedData) {
        currentWeatherData = { current: cachedData.currentWeather };
        forecastData = { forecast: cachedData.forecast };
        updateLastUpdated();
        displayCurrentWeather();
        displayForecast();
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

async function loadCurrentWeather(locationQuery, locationId, saveToDB = true) {
    try {
        const result = await apiCall(`/weather/current?q=${encodeURIComponent(locationQuery)}`);
        if (result.ok && result.data.current) {
            currentWeatherData = result.data;
            if (saveToDB) {
                setTimeout(() => saveWeatherData(locationId, result.data.current, forecastData?.forecast), 100);
            }
            displayCurrentWeather();
        }
    } catch (error) {
        console.error("Current weather error:", error);
    }
}

async function loadForecast(locationQuery, locationId, saveToDB = true) {
    try {
        const result = await apiCall(`/weather/forecast?q=${encodeURIComponent(locationQuery)}&days=1`);
        if (result.ok && result.data.forecast) {
            forecastData = result.data;
            if (saveToDB) {
                saveWeatherData(locationId, currentWeatherData?.current, result.data.forecast);
            }
            displayForecast();
        }
    } catch (error) {
        console.error("Forecast error:", error);
    }
}

function displayCurrentWeather() {
    if (!currentWeatherData?.current) return;

    const data = currentWeatherData.current;
    document.getElementById("currentTemp").textContent = Math.round(data.temp_c);
    document.getElementById("currentCondition").textContent = data.condition.text;
    
    document.getElementById("currentIcon").src = `https:${data.condition.icon}`;
    document.getElementById("currentIcon").alt = data.condition.text;
    
    document.getElementById("feelsLike").textContent = `${Math.round(data.feelslike_c)}°`;
    document.getElementById("humidity").textContent = `${data.humidity}%`;
    document.getElementById("windSpeed").textContent = `${Math.round(data.wind_kph)} kph`;
    document.getElementById("precipitation").textContent = data.precip_mm ? `${data.precip_mm}mm` : "0mm";
}

function displayForecast() {
    if (!forecastData?.forecast?.forecastday?.[0]?.hour) return;

    const hours = forecastData.forecast.forecastday[0].hour.slice(0, 24);
    const forecastList = document.getElementById("forecastList");
    forecastList.innerHTML = "";

    hours.forEach(hour => {
        const item = document.createElement("div");
        item.className = "forecast-item";
        item.innerHTML = `
            <div class="forecast-icon">
                <img src="https:${hour.condition.icon}" alt="${hour.condition.text}" onerror="this.style.display='none'">
            </div>
            <div class="forecast-time">${hour.time.split(' ')[1]}</div>
            <div class="forecast-details">
                <div class="forecast-temp">${Math.round(hour.temp_c)}°</div>
                <div class="forecast-desc">${hour.condition.text}</div>
            </div>
        `;
        forecastList.appendChild(item);
    });
}

function updateLastUpdated() {
    const now = new Date();
    document.getElementById("lastUpdated").textContent = `Updated ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`;
}

async function loadLocations() {
    try {
        const locations = await getAllLocations();
        const locationList = document.getElementById("locationList");
        locationList.innerHTML = "";

        if (locations.length === 0) {
            locationList.innerHTML = `
                <div class="empty-state">
                    <p>No locations added yet</p>
                    <p>Click + to add your first location</p>
                </div>
            `;
            return;
        }

        locations.forEach(location => {
            const item = document.createElement("div");
            item.className = `location-item ${currentLocationId === location.id ? 'active' : ''}`;
            item.dataset.locationId = location.id;
            item.innerHTML = `
                <div class="location-avatar">${location.name.charAt(0).toUpperCase()}</div>
                <div class="location-preview">
                    <div class="location-name">${location.name}</div>
                </div>
                <button class="delete-location" data-id="${location.id}">×</button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains("delete-location")) {
                    selectLocation(location.id, location.name, location.query);
                }
            });
            
            locationList.appendChild(item);
        });

        document.querySelectorAll(".delete-location").forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const id = parseInt(e.target.dataset.id);
                if (confirm("Delete this location?")) {
                    await deleteLocation(id);
                    await loadLocations();
                    if (currentLocationId === id) {
                        showWeatherListMobile();
                        currentLocationId = null;
                        document.getElementById("noLocationSelected").style.display = "flex";
                        document.getElementById("weatherContainer").style.display = "none";
                    }
                }
            };
        });
    } catch (error) {
        console.error("Failed to load locations:", error);
    }
}

async function selectLocation(id, name, query) {
    currentLocationId = id;
    currentLocationData = { id, name, query };
    
    document.getElementById("locationTitle").textContent = name;
    document.getElementById("noLocationSelected").style.display = "none";
    document.getElementById("weatherContainer").style.display = "flex";
    
    showWeatherMobile();
    applyLayoutForViewport();
    
    const hasCachedData = await loadLocationWeather(id);
    
    if (!hasCachedData) {
        updateLastUpdated();
        await Promise.all([
            loadCurrentWeather(query, id, true),
            loadForecast(query, id, true)
        ]);
    }
    
    document.querySelectorAll(".location-item").forEach(item => item.classList.remove("active"));
    document.querySelector(`[data-location-id="${id}"]`)?.classList.add("active");
}

function closeModal() {
    document.getElementById("newLocationModal").style.display = "none";
    document.getElementById("locationInput").value = "";
    document.getElementById("saveLocationBtn").disabled = true;
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
    await loadLocations();
    applyLayoutForViewport();
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initDB();
    } catch (error) {
        console.error("Database initialization failed:", error);
    }

    document.getElementById("newLocationButton").onclick = () => {
        document.getElementById("newLocationModal").style.display = "flex";
    };

    document.getElementById("closeModal").onclick = closeModal;
    document.getElementById("cancelLocationBtn").onclick = closeModal;
    
    document.getElementById("locationInput").oninput = (e) => {
        document.getElementById("saveLocationBtn").disabled = !e.target.value.trim();
    };

    document.getElementById("saveLocationBtn").onclick = async () => {
        const name = document.getElementById("locationInput").value.trim();
        if (name) {
            try {
                await addLocation(name);
                await loadLocations();
                closeModal();
                const locations = await getAllLocations();
                const newLocation = locations[locations.length - 1];
                if (newLocation) {
                    selectLocation(newLocation.id, newLocation.name, newLocation.query);
                }
            } catch (error) {
                console.error("Failed to save location:", error);
                alert("Failed to save location");
            }
        }
    };

    document.getElementById("backButton").onclick = showWeatherListMobile;
    
    document.getElementById("refreshButton").onclick = async () => {
        if (currentLocationData && !document.getElementById("refreshButton").disabled) {
            document.getElementById("refreshButton").disabled = true;
            await Promise.all([
                loadCurrentWeather(currentLocationData.query, currentLocationData.id, true),
                loadForecast(currentLocationData.query, currentLocationData.id, true)
            ]);
            document.getElementById("refreshButton").disabled = false;
        }
    };

    document.getElementById("newLocationModal").onclick = (e) => {
        if (e.target.classList.contains("modal-overlay")) {
            closeModal();
        }
    };

    init();
});

window.addEventListener("resize", applyLayoutForViewport);
