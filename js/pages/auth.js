const BACKEND_URL = "https://pingme-backend-nu.vercel.app";

function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

async function createUser(user) {
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(user)
    });

    const data = await res.json();
    return data;
}

async function loginUser(user) {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(user)
    });
    const data = await res.json();
    return data;
}

async function deleteAccount() {
    const token = getToken();
    if (!token) {
        alert('Please log in first');
        return;
    }

    // Show loading (if delete page has loading element)
    const loadingEl = document.getElementById('loading');
    const deleteBtn = document.querySelector('.btn-danger');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (deleteBtn) deleteBtn.style.display = 'none';

    try {
        const response = await fetch(`${BACKEND_URL}/auth/account`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionToken: token })
        });

        const data = await response.json();

        if (response.ok && data.message === 'deleted successfully') {
            // Clear token and redirect
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            alert('Account deleted successfully. Goodbye!');
            window.location.href = '/';
        } else if (data.message === "user doesn't exist") {
            alert('User not found');
            window.location.href = '/';
        } else {
            throw new Error(data.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting account: ' + error.message);
    } finally {
        // Hide loading
        if (loadingEl) loadingEl.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    }
}

function initAuth() {
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            
            const user = {
                name: document.getElementById("username").value,
                email: document.getElementById("email").value,
                password: document.getElementById("password").value
            };

            try {
                const result = await createUser(user);
                console.log("User created:", result);
                alert("Account created successfully!");
                window.location.href = "login.html";
            } catch (error) {
                console.error("Error creating user:", error);
                alert("There was a problem creating your account.");
            }
        });
        return;
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            
            const user = {
                email: document.getElementById("email").value,
                password: document.getElementById("password").value
            };

            try {
                const result = await loginUser(user);
                console.log("User logged in:", result);
                alert("Logged in successfully!");
                // redirect to AccountPage?
                window.location.href = "account.html";
            } catch (error) {
                console.error("Error logging in:", error);
                alert("There was a problem logging in.");
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", initAuth);