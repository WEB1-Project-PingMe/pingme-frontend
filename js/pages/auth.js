const BACKEND_URL = 'https://pingme-backend-nu.vercel.app';

async function createUser(user) {
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(user)
    });

    const data = await res.json();
    return data;
}

async function loginUser(user) {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(user)
    });
    const data = await res.json();
    return data;
}

function initAuth() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const user = {
                name: document.getElementById('username').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            };

            try {
                const result = await createUser(user);
                console.log('User created:', result);
                alert('Account created successfully!');
                // redirect to login
                // window.location.href = 'login.html';
            } catch (error) {
                console.error('Error creating user:', error);
                alert('There was a problem creating your account.');
            }
        });
        return;
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const user = {
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            };

            try {
                const result = await loginUser(user);
                console.log('User logged in:', result);
                alert('Logged in successfully!');
                // redirect to homepage? 
                // window.location.href = 'x.html';
            } catch (error) {
                console.error('Error logging in:', error);
                alert('There was a problem logging in.');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initAuth);