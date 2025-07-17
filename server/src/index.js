const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { db } = require('./lib');
const auth = require('basic-auth');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Allow requests from your Vite development server
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json()); // Enable JSON body parsing
app.use('/png', express.static(path.join(__dirname, '..', '..', 'data', 'png')));

const { authenticate, authorize } = require('./middleware/auth');

// Test DB connection
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected successfully.');
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

app.get('/', (req, res) => {
  res.send('<h1>Dental Scheduler API</h1>');
});

// Apply authentication to all /api routes
app.use('/api', authenticate);

// Multer storage configuration for handwriting PNGs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', 'data', 'png');
    fs.mkdirSync(uploadPath, { recursive: true }); // Ensure directory exists
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + '.png');
  },
});

const upload = multer({ storage: storage });

// Serve handwriting PNGs
app.use('/api/handwriting', express.static(path.join(__dirname, '..', '..', 'data', 'png')));

// POST /api/handwriting - Upload a handwriting PNG
app.post('/api/handwriting', authenticate, upload.single('handwriting'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  // Return the filename (UUID.png) so it can be stored in the reservation
  res.status(201).json({ filename: req.file.filename });
});



// User Management Endpoints (Admin only)
// POST /api/users - Create a new user
app.post('/api/users', authorize('admin'), async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing username, password, or role.' });
  }

  try {
    const existingUser = await db('users').where({ username }).first();
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10); // Hash password
    const [id] = await db('users').insert({
      username,
      password_hash,
      role,
    });
    const newUser = await db('users').where({ id }).first();
    // Omit password_hash from response for security
    const { password_hash: _, ...userWithoutHash } = newUser;
    res.status(201).json(userWithoutHash);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// GET /api/users - Get all users
app.get('/api/users', authorize('admin'), async (req, res) => {
  try {
    const users = await db('users').select('id', 'username', 'role');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// PUT /api/users/:id - Update a user
app.put('/api/users/:id', authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  if (!username && !password && !role) {
    return res.status(400).json({ error: 'No fields provided for update.' });
  }

  try {
    const updateData = {};
    if (username) updateData.username = username;
    if (role) updateData.role = role;
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);
    updateData.updated_at = db.fn.now();

    const updatedRows = await db('users').where({ id }).update(updateData);

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser = await db('users').where({ id }).first();
    const { password_hash: _, ...userWithoutHash } = updatedUser;
    res.json(userWithoutHash);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// DELETE /api/users/:id - Delete a user
app.delete('/api/users/:id', authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const deletedRows = await db('users').where({ id }).del();

    if (deletedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

io.on('connection', (socket) => {
  console.log(`a user connected: ${socket.id}`);

  // Join a room based on the date
  socket.on('join-date-room', (date) => {
    // Leave previous room if any
    if (socket.currentRoom) {
      socket.leave(socket.currentRoom);
    }
    socket.join(date);
    socket.currentRoom = date;
    console.log(`Socket ${socket.id} joined room ${date}`);
  });

  socket.on('fetch-reservations', async (date) => {
    try {
      const reservations = await db('reservations').where({ date }).select('*');
      socket.emit('reservations-updated', reservations);
    } catch (err) {
      console.error(`Error fetching reservations for date ${date}:`, err);
      // Optionally, emit an error to the client
      socket.emit('error', { message: 'Failed to fetch reservations.' });
    }
  });

  socket.on('save-reservation', async (reservation) => {
    try {
      let savedReservation;
      if (reservation.id) {
        // Update existing reservation
        await db('reservations').where({ id: reservation.id }).update({
          ...reservation,
          updated_at: db.fn.now(),
        });
        savedReservation = await db('reservations').where({ id: reservation.id }).first();
      } else {
        // Create new reservation
        const [id] = await db('reservations').insert(reservation);
        savedReservation = await db('reservations').where({ id }).first();
      }

      // Notify all clients in the same date room
      const reservationsForDate = await db('reservations').where({ date: savedReservation.date }).select('*');
      io.to(savedReservation.date).emit('reservations-updated', reservationsForDate);

    } catch (err) {
      console.error('Error saving reservation:', err);
      socket.emit('error', { message: 'Failed to save reservation.' });
    }
  });

  socket.on('delete-reservation', async (id) => {
    try {
      const reservationToDelete = await db('reservations').where({ id }).first();
      if (!reservationToDelete) {
        socket.emit('error', { message: 'Reservation not found.' });
        return;
      }

      await db('reservations').where({ id }).del();

      // Notify all clients in the same date room
      const reservationsForDate = await db('reservations').where({ date: reservationToDelete.date }).select('*');
      io.to(reservationToDelete.date).emit('reservations-updated', reservationsForDate);

    } catch (err) {
      console.error('Error deleting reservation:', err);
      socket.emit('error', { message: 'Failed to delete reservation.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`user disconnected: ${socket.id}`);
  });
}); // This closes the io.on('connection') block

// POST /api/reservations - Create a new reservation
app.post('/api/reservations', authenticate, async (req, res) => {
  const { date, time_min, column_index, patient_name, handwriting } = req.body;

  // Basic validation
  if (!date || time_min === undefined || column_index === undefined || (!patient_name && !handwriting)) {
    return res.status(400).json({ error: 'Missing required reservation fields.' });
  }

  console.log('Received POST /api/reservations request with body:', req.body);
  try {
    const [id] = await db('reservations').insert({
      date,
      time_min,
      column_index,
      patient_name,
      handwriting,
    });
    const newReservation = await db('reservations').where({ id }).first();
    io.emit('reservations-updated', await db('reservations').select('*')); // Notify clients
    res.status(201).json(newReservation);
  } catch (err) {
    console.error('Error creating reservation:', err);
    res.status(500).json({ error: 'Failed to create reservation.', details: err.message });
  }
});

// GET /api/reservations - Fetch all reservations, optionally filtered by date
app.get('/api/reservations', authenticate, async (req, res) => {
  try {
    let query = db('reservations').select('*');
    if (req.query.date) {
      query = query.where({ date: req.query.date });
    }
    const reservations = await query;
    res.json(reservations);
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// PUT /api/reservations/:id - Update an existing reservation
app.put('/api/reservations/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { date, time_min, column_index, patient_name, handwriting } = req.body;

  if (!date || time_min === undefined || column_index === undefined || (!patient_name && !handwriting)) {
    return res.status(400).json({ error: 'Missing required reservation fields for update.' });
  }

  console.log('Received PUT /api/reservations/:id request with body:', req.body);
  try {
    const updatedRows = await db('reservations').where({ id }).update({
      date,
      time_min,
      column_index,
      patient_name,
      handwriting,
      updated_at: db.fn.now(), // Update timestamp
    });

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    };

    const updatedReservation = await db('reservations').where({ id }).first();
    io.emit('reservations-updated', await db('reservations').select('*')); // Notify clients
    res.json(updatedReservation);
  } catch (err) {
    console.error('Error updating reservation:', err);
    res.status(500).json({ error: 'Failed to update reservation.', details: err.message });
  }
});

// DELETE /api/reservations/:id - Delete a reservation
app.delete('/api/reservations/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    // まず予約情報を取得
    const reservationToDelete = await db('reservations').where({ id }).first();

    if (!reservationToDelete) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    const deletedRows = await db('reservations').where({ id }).del();

    // Delete associated handwriting PNG if it exists
    if (reservationToDelete.handwriting) {
      const filePath = path.join(__dirname, '..', '..', 'data', 'png', reservationToDelete.handwriting);
      try {
        await fs.promises.unlink(filePath); // await を追加
      } catch (err) {
        // ファイルが存在しない場合など、エラーを無視する
        if (err.code !== 'ENOENT') {
          console.error('Error deleting handwriting PNG:', err);
        }
      }
    }

    io.emit('reservations-updated', await db('reservations').select('*')); // Notify clients
    res.status(204).send(); // No content for successful deletion
  } catch (err) {
    console.error('Error deleting reservation:', err);
    res.status(500).json({ error: 'Failed to delete reservation.' });
  }
});

function startServer(port, callback) {
  return server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    if (callback) callback();
  });
}

// Handle graceful shutdown
// Handle graceful shutdown (listeners are typically managed by process managers like concurrently)
// process.on('SIGTERM', () => {
//   console.log('SIGTERM received, closing server...');
//   server.close(() => {
//     console.log('Server closed.');
//     process.exit(0);
//   });
// });

// process.on('SIGINT', () => {
//   console.log('SIGINT received, closing server...');
//   server.close(() => {
//     console.log('Server closed.');
//     process.exit(0);
//   });
// });

// If this file is run directly (not imported as a module), start the server
if (require.main === module) {
  startServer(PORT);
}

module.exports = { app, server, io, startServer }; // Export startServer for testing

  
