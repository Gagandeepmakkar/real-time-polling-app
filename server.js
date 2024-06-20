// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let pollData = {
    options: ["Option 1", "Option 2", "Option 3"],
    votes: [0, 0, 0]
};

let chatMessages = [];
let users = {}; // socket.id -> { username, userId }
let votes = {}; // userId -> optionIndex
let registeredUsers = {}; // username -> { userId, passwordHash }

// Middleware to set a unique userId cookie if not present
app.use((req, res, next) => {
    if (!req.cookies.userId) {
        res.cookie('userId', uuidv4(), { maxAge: 900000, httpOnly: true });
    }
    next();
});

// Endpoint to register a new user
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (registeredUsers[username]) {
        return res.status(400).json({ message: 'Username already exists' });
    }
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    registeredUsers[username] = { userId, passwordHash };
    res.cookie('userId', userId, { maxAge: 900000, httpOnly: true });
    res.status(200).json({ message: 'Registration successful' });
});

// Endpoint to login an existing user
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = registeredUsers[username];
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }
    // Emit login success with pollData and chatMessages
    res.cookie('userId', user.userId, { maxAge: 900000, httpOnly: true });
    const userData = {
        username,
        pollData,
        chatMessages
    };
    res.status(200).json({ message: 'Login successful', userData });
});

io.on('connection', (socket) => {
    console.log('New client connected');

    // Extract userId from cookies
    const cookie = socket.handshake.headers.cookie || '';
    const userIdMatch = cookie.match(/userId=([^;]+)/);
    const userId = userIdMatch ? userIdMatch[1] : uuidv4();

    socket.on('register', (username) => {
        const user = registeredUsers[username];
        if (user && user.userId === userId) {
            users[socket.id] = { username, userId };
            socket.emit('registrationSuccess', username);
            io.emit('userUpdate', Object.values(users).map(user => user.username));
        } else {
            socket.emit('registrationFailed', 'User not authenticated');
        }
    });

    socket.on('login', (username) => {
        const user = registeredUsers[username];
        if (user && user.userId === userId) {
            users[socket.id] = { username, userId };
            socket.emit('loginSuccess', { username, pollData, chatMessages });
            io.emit('userUpdate', Object.values(users).map(user => user.username));
        } else {
            socket.emit('loginFailed', 'User not authenticated');
        }
    });

    socket.emit('initialData', { pollData, chatMessages });

    socket.on('vote', (optionIndex) => {
        if (votes[userId] == null) {
            votes[userId] = optionIndex;
            pollData.votes[optionIndex]++;
            io.emit('pollUpdate', pollData);
        } else {
            socket.emit('voteError', 'You have already voted');
        }
    });

    socket.on('newMessage', (message) => {
        const user = users[socket.id];
        if (user) {
            const fullMessage = `${user.username}: ${message}`;
            chatMessages.push(fullMessage);
            io.emit('messageUpdate', chatMessages);
        }
    });

    socket.on('typing', () => {
        const user = users[socket.id];
        if (user) {
            socket.broadcast.emit('typing', user.username);
        }
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('userUpdate', Object.values(users).map(user => user.username));
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
