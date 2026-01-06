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

        // Add form submit event handler
document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent form from submitting traditionally
    
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