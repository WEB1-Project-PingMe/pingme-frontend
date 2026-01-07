async function createUser(user) {
    const res = await fetch('/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(user)
    });

    const data = await res.json();
    return data;
}

document.getElementById('registerForm').addEventListener('submit', async (event) => {
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
    } catch (error) {
        console.error('Error creating user:', error);
        alert('There was a problem creating your account.');
    }
});

async function loginUser(user) {
    const res = await fetch('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(user)
    });

    const data = await res.json();
    return data;
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const user = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };

    try {
        const result = await loginUser(user);
        console.log('User logged in:', result);
        alert('Account logged in successfully!');
    } catch (error) {
        console.error('Error logging in user:', error);
        alert('There was a problem logging in your account.');
    }
});