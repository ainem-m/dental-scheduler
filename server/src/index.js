const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { db } = require('./lib');
const { authenticate } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Make io instance available to routes
app.set('io', io);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/handwriting', express.static(path.join(__dirname, '..', '..', 'data', 'png')));


// Import routes
const userRoutes = require('./routes/users');
const reservationRoutes = require('./routes/reservations');

// Setup Socket.IO event handlers
// require('./socket')(io); // This will be enabled in the next step

// Test DB connection
db.raw('SELECT 1')
  .then(() => console.log('Database connected successfully.'))
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

// Root endpoint
app.get('/', (req, res) => {
  res.send('<h1>Dental Scheduler API</h1>');
});

// Apply authentication to all /api routes
app.use('/api', authenticate);

// Mount routers
app.use('/api/users', userRoutes);
app.use('/api', reservationRoutes);


// Setup Socket.IO event handlers
require('./socket')(io);

function startServer(port, callback) {
  return server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    if (callback) callback();
  });
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = { app, server, io, startServer };