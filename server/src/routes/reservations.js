const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { db } = require('../lib');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Multer storage configuration for handwriting PNGs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', '..', 'data', 'png');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + '.png');
  },
});

const upload = multer({ storage: storage });

// Note: In index.js, app.use('/api', authenticate) is applied globally.
// So all routes here are already authenticated.

// POST /api/handwriting - Upload a handwriting PNG
router.post('/handwriting', upload.single('handwriting'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  res.status(201).json({ filename: req.file.filename });
});

// GET /api/reservations - Fetch all reservations, optionally filtered by date
router.get('/reservations', async (req, res) => {
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

// POST /api/reservations - Create a new reservation
router.post('/reservations', async (req, res) => {
  const { date, time_min, column_index, patient_name, handwriting } = req.body;
  const io = req.app.get('io'); // Get io instance from app

  if (!date || time_min === undefined || column_index === undefined || (!patient_name && !handwriting)) {
    return res.status(400).json({ error: 'Missing required reservation fields.' });
  }

  try {
    const [id] = await db('reservations').insert({
      date,
      time_min,
      column_index,
      patient_name,
      handwriting,
    });
    const newReservation = await db('reservations').where({ id }).first();
    
    // Fetch all reservations for the date and emit
    const reservationsForDate = await db('reservations').where({ date }).select('*');
    io.to(date).emit('reservations-updated', reservationsForDate);

    res.status(201).json(newReservation);
  } catch (err) {
    console.error('Error creating reservation:', err);
    res.status(500).json({ error: 'Failed to create reservation.', details: err.message });
  }
});

// PUT /api/reservations/:id - Update an existing reservation
router.put('/reservations/:id', async (req, res) => {
  const { id } = req.params;
  const { date, time_min, column_index, patient_name, handwriting } = req.body;
  const io = req.app.get('io');

  if (!date || time_min === undefined || column_index === undefined || (!patient_name && !handwriting)) {
    return res.status(400).json({ error: 'Missing required reservation fields for update.' });
  }

  try {
    const updatedRows = await db('reservations').where({ id }).update({
      date,
      time_min,
      column_index,
      patient_name,
      handwriting,
      updated_at: db.fn.now(),
    });

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    const updatedReservation = await db('reservations').where({ id }).first();
    const reservationsForDate = await db('reservations').where({ date: updatedReservation.date }).select('*');
    io.to(updatedReservation.date).emit('reservations-updated', reservationsForDate);
    
    res.json(updatedReservation);
  } catch (err) {
    console.error('Error updating reservation:', err);
    res.status(500).json({ error: 'Failed to update reservation.', details: err.message });
  }
});

// DELETE /api/reservations/:id - Delete a reservation
router.delete('/reservations/:id', async (req, res) => {
  const { id } = req.params;
  const io = req.app.get('io');

  try {
    const reservationToDelete = await db('reservations').where({ id }).first();

    if (!reservationToDelete) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    await db('reservations').where({ id }).del();

    if (reservationToDelete.handwriting) {
      const filePath = path.join(__dirname, '..', '..', '..', 'data', 'png', reservationToDelete.handwriting);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Error deleting handwriting PNG:', err);
        }
      }
    }

    const reservationsForDate = await db('reservations').where({ date: reservationToDelete.date }).select('*');
    io.to(reservationToDelete.date).emit('reservations-updated', reservationsForDate);
    
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting reservation:', err);
    res.status(500).json({ error: 'Failed to delete reservation.' });
  }
});

module.exports = router;
