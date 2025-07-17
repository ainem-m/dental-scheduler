const { db } = require('../lib');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log(`a user connected: ${socket.id}`);

    // Join a room based on the date
    socket.on('join-date-room', (date) => {
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
        socket.emit('error', { message: 'Failed to fetch reservations.' });
      }
    });

    socket.on('save-reservation', async (reservation) => {
      try {
        let savedReservation;
        if (reservation.id) {
          await db('reservations').where({ id: reservation.id }).update({
            ...reservation,
            updated_at: db.fn.now(),
          });
          savedReservation = await db('reservations').where({ id: reservation.id }).first();
        } else {
          const [id] = await db('reservations').insert(reservation);
          savedReservation = await db('reservations').where({ id }).first();
        }

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
          return socket.emit('error', { message: 'Reservation not found.' });
        }

        await db('reservations').where({ id }).del();

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
  });
};
