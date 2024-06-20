// script.js
const socket = io();

const authDiv = document.getElementById('auth');
const pollAndChatDiv = document.getElementById('pollAndChat');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const optionsDiv = document.getElementById('options');
const messagesDiv = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');

registerBtn.onclick = () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (username && password) {
        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            if (data.message === 'Registration successful') {
                socket.emit('register', username);
            }
        })
        .catch(error => console.error('Error:', error));
    } else {
        alert('Please enter both username and password');
    }
};

loginBtn.onclick = () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (username && password) {
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            if (data.message === 'Login successful') {
                socket.emit('login', username); // Emit login event upon successful login
            }
        })
        .catch(error => console.error('Error:', error));
    } else {
        alert('Please enter both username and password');
    }
};

socket.on('loginSuccess', ({ username, pollData, chatMessages }) => {
    authDiv.style.display = 'none';  // Hide the authentication div
    pollAndChatDiv.style.display = 'flex';  // Display the poll and chat div

    // Render initial poll options
    optionsDiv.innerHTML = '';
    pollData.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = `${option} (${pollData.votes[index]})`;
        button.onclick = () => socket.emit('vote', index);
        optionsDiv.appendChild(button);
    });

    // Render initial chat messages
    messagesDiv.innerHTML = '';
    chatMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messagesDiv.appendChild(messageDiv);
    });
});

socket.on('pollUpdate', (pollData) => {
    // Update poll options with new vote counts
    optionsDiv.innerHTML = '';
    pollData.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = `${option} (${pollData.votes[index]})`;
        button.onclick = () => socket.emit('vote', index);
        optionsDiv.appendChild(button);
    });
});

socket.on('messageUpdate', (chatMessages) => {
    // Update chat messages with new message
    const newMessage = chatMessages[chatMessages.length - 1];
    const messageDiv = document.createElement('div');
    messageDiv.textContent = newMessage;
    messagesDiv.appendChild(messageDiv);
});

sendBtn.onclick = () => {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('newMessage', message);
        chatInput.value = '';
    }
};

chatInput.oninput = () => {
    socket.emit('typing');
};

socket.on('typing', (user) => {
    typingIndicator.textContent = `${user} is typing...`;
    setTimeout(() => {
        typingIndicator.textContent = '';
    }, 3000);
});
