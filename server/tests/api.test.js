const request = require('supertest');
const indexModule = require('../src/index');
const app = indexModule.app;
const server = indexModule.server;
const io = indexModule.io;
const startServer = indexModule.startServer;
const { db } = require('../src/lib');
const bcrypt = require('bcrypt');
const { io: Client } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

let adminCredentials;
let staffCredentials;
let clientSocket;

beforeAll(async () => {
  await db.migrate.latest();
  await db.seed.run();

  adminCredentials = { name: 'admin', pass: 'password' };
  staffCredentials = { name: 'staff', pass: 'password' };

  // Start the server explicitly for tests
  await new Promise(resolve => startServer(0, resolve)); // Use port 0 for ephemeral port

  const port = server.address().port;
  clientSocket = Client(`http://localhost:${port}`);
  await new Promise((resolve) => {
    clientSocket.on('connect', resolve);
  });
});

afterAll(async () => {
  if(clientSocket) {
    clientSocket.disconnect();
  }
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => setTimeout(resolve, 500)); // Add a small delay
  await db.destroy();
});

describe('Authentication and Authorization', () => {
  it('should return 401 for unauthenticated access to /api/reservations', async () => {
    const res = await request(app).get('/api/reservations');
    expect(res.statusCode).toEqual(401);
  });

  it('should allow authenticated staff to access /api/reservations', async () => {
    const res = await request(app)
      .get('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass);
    expect(res.statusCode).toEqual(200);
  });

  it('should return 403 for staff trying to access /api/users', async () => {
    const res = await request(app)
      .get('/api/users')
      .auth(staffCredentials.name, staffCredentials.pass);
    expect(res.statusCode).toEqual(403);
  });

  it('should allow admin to access /api/users', async () => {
    const res = await request(app)
      .get('/api/users')
      .auth(adminCredentials.name, adminCredentials.pass);
    expect(res.statusCode).toEqual(200);
  });
});

describe('Reservations API', () => {
  beforeEach(async () => {
    await db('reservations').del();
  });

  it('should create a new reservation', async () => {
    const newReservation = {
      date: '2025-07-16',
      time_min: 600,
      column_index: 2,
      patient_name: 'New Patient'
    };
    const res = await request(app)
      .post('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass)
      .send(newReservation);

    expect(res.statusCode).toEqual(201);
    expect(res.body.patient_name).toBe('New Patient');
  });

  it('should fetch all reservations', async () => {
    await db('reservations').insert({
      date: '2025-07-16',
      time_min: 600,
      column_index: 2,
      patient_name: 'Test Patient 1'
    });
    await db('reservations').insert({
      date: '2025-07-17',
      time_min: 700,
      column_index: 3,
      patient_name: 'Test Patient 2'
    });

    const res = await request(app)
      .get('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].patient_name).toBe('Test Patient 1');
  });

  it('should fetch reservations by date', async () => {
    await db('reservations').insert({
      date: '2025-07-16',
      time_min: 600,
      column_index: 2,
      patient_name: 'Test Patient 1'
    });
    await db('reservations').insert({
      date: '2025-07-17',
      time_min: 700,
      column_index: 3,
      patient_name: 'Test Patient 2'
    });

    const res = await request(app)
      .get('/api/reservations?date=2025-07-16')
      .auth(staffCredentials.name, staffCredentials.pass);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].patient_name).toBe('Test Patient 1');
  });

  it('should update an existing reservation', async () => {
    const [id] = await db('reservations').insert({
      date: '2025-07-16',
      time_min: 600,
      column_index: 2,
      patient_name: 'Original Patient'
    });

    const updatedReservation = {
      date: '2025-07-16',
      time_min: 600,
      column_index: 2,
      patient_name: 'Updated Patient'
    };

    const res = await request(app)
      .put(`/api/reservations/${id}`)
      .auth(staffCredentials.name, staffCredentials.pass)
      .send(updatedReservation);

    expect(res.statusCode).toEqual(200);
    expect(res.body.patient_name).toBe('Updated Patient');

    const dbReservation = await db('reservations').where({ id }).first();
    expect(dbReservation.patient_name).toBe('Updated Patient');
  });

  it('should delete a reservation', async () => {
    const [id] = await db('reservations').insert({
      date: '2025-07-16',
      time_min: 600,
      column_index: 2,
      patient_name: 'Patient to Delete'
    });

    const res = await request(app)
      .delete(`/api/reservations/${id}`)
      .auth(staffCredentials.name, staffCredentials.pass);

    expect(res.statusCode).toEqual(204);

    const dbReservation = await db('reservations').where({ id }).first();
    expect(dbReservation).toBeUndefined();
  });
});

describe('Socket.IO Reservation Events', () => {
  beforeEach(async () => {
    await db('reservations').del();
  });

  afterEach(() => {
    clientSocket.off('reservations-updated');
  });

  it('should save a new reservation via socket and emit reservations-updated', async () => {
    const newReservation = {
      date: '2025-07-16',
      time_min: 600,
      column_index: 2,
      patient_name: 'Socket Patient Save',
      handwriting: null,
    };

    let receivedReservations;
    const reservationsUpdatedPromise = new Promise((resolve) => {
      clientSocket.once('reservations-updated', (reservations) => {
        receivedReservations = reservations;
        resolve();
      });
    });

    // Join the room for the specific date before saving
    clientSocket.emit('join-date-room', newReservation.date);
    clientSocket.emit('save-reservation', newReservation);
    await reservationsUpdatedPromise;

    const found = receivedReservations.find(r => r.patient_name === 'Socket Patient Save');
    expect(found).toBeDefined();

    const dbReservation = await db('reservations').where({ patient_name: 'Socket Patient Save' }).first();
    expect(dbReservation).toBeDefined();
  }, 10000);

  it('should fetch reservations via socket and emit reservations-updated', async () => {
    // First, save a reservation to ensure there's data to fetch
    await db('reservations').insert({
      date: '2025-07-17',
      time_min: 700,
      column_index: 3,
      patient_name: 'Fetched Patient',
      handwriting: null,
    });

    let receivedReservations;
    const reservationsUpdatedPromise = new Promise((resolve) => {
      clientSocket.once('reservations-updated', (reservations) => {
        receivedReservations = reservations;
        resolve();
      });
    });

    clientSocket.emit('fetch-reservations', '2025-07-17');
    await reservationsUpdatedPromise;

    const found = receivedReservations.find(r => r.patient_name === 'Fetched Patient');
    expect(found).toBeDefined();
  }, 10000);

  it('should delete a reservation via socket and emit reservations-updated', async () => {
    // First, save a reservation to ensure there's data to delete
    const [id] = await db('reservations').insert({
      date: '2025-07-18',
      time_min: 800,
      column_index: 4,
      patient_name: 'Patient to Delete',
      handwriting: null,
    });

    let receivedReservations;
    const reservationsUpdatedPromise = new Promise((resolve) => {
      clientSocket.once('reservations-updated', (reservations) => {
        receivedReservations = reservations;
        resolve();
      });
    });

    // Join the room for the specific date before deleting
    clientSocket.emit('join-date-room', '2025-07-18');
    clientSocket.emit('delete-reservation', id);
    await reservationsUpdatedPromise;

    const found = receivedReservations.find(r => r.id === id);
    expect(found).toBeUndefined();

    const deletedReservation = await db('reservations').where({ id }).first();
    expect(deletedReservation).toBeUndefined();
  }, 10000);
});

describe('Handwriting API', () => {
  const testPngPath = path.join(__dirname, 'test.png');

  beforeAll(() => {
    // Create a dummy PNG file for testing
    fs.writeFileSync(testPngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]));
  });

  afterAll(() => {
    // Clean up the dummy PNG file
    if (fs.existsSync(testPngPath)) {
      fs.unlinkSync(testPngPath);
    }
  });

  it('should upload a handwriting PNG and return its filename', async () => {
    const res = await request(app)
      .post('/api/handwriting')
      .auth(staffCredentials.name, staffCredentials.pass)
      .attach('handwriting', testPngPath);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('filename');
    expect(res.body.filename).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.png$/);

    // Verify the file exists on disk
    const uploadedFilePath = path.join(__dirname, '..', '..', 'data', 'png', res.body.filename);
    expect(fs.existsSync(uploadedFilePath)).toBe(true);

    // Clean up the uploaded file
    fs.unlinkSync(uploadedFilePath);
  });
});

describe('Reservations API - Handwriting Cleanup', () => {
  const testPngPath = path.join(__dirname, 'test_delete.png');
  let reservationId;
  let handwritingFilename;

  beforeEach(async () => {
    // Create a dummy PNG file for testing deletion
    fs.writeFileSync(testPngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]));

    // Upload the PNG and create a reservation with it
    const uploadRes = await request(app)
      .post('/api/handwriting')
      .auth(staffCredentials.name, staffCredentials.pass)
      .attach('handwriting', testPngPath);

    handwritingFilename = uploadRes.body.filename;

    const newReservation = {
      date: '2025-07-17',
      time_min: 700,
      column_index: 3,
      patient_name: null,
      handwriting: handwritingFilename,
    };

    const res = await request(app)
      .post('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass)
      .send(newReservation);

    reservationId = res.body.id;
  });

  afterEach(() => {
    // Clean up the dummy PNG file
    if (fs.existsSync(testPngPath)) {
      fs.unlinkSync(testPngPath);
    }
    // Ensure the uploaded file is cleaned up if test fails before deletion
    const uploadedFilePath = path.join(__dirname, '..', '..', 'data', 'png', handwritingFilename);
    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
  });

  it('should delete a reservation and its associated handwriting PNG', async () => {
    const uploadedFilePath = path.join(__dirname, '..', '..', 'data', 'png', handwritingFilename);
    expect(fs.existsSync(uploadedFilePath)).toBe(true); // Ensure file exists before deletion

    const res = await request(app)
      .delete(`/api/reservations/${reservationId}`)
      .auth(staffCredentials.name, staffCredentials.pass);

    expect(res.statusCode).toEqual(204);

    // Verify the reservation is deleted from DB
    const deletedReservation = await db('reservations').where({ id: reservationId }).first();
    expect(deletedReservation).toBeUndefined();

    // Verify the PNG file is deleted from disk
    expect(fs.existsSync(uploadedFilePath)).toBe(false);
  });
});

describe('Handwriting API', () => {
  const testPngPath = path.join(__dirname, 'test.png');

  beforeAll(() => {
    // Create a dummy PNG file for testing
    fs.writeFileSync(testPngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]));
  });

  afterAll(() => {
    // Clean up the dummy PNG file
    if (fs.existsSync(testPngPath)) {
      fs.unlinkSync(testPngPath);
    }
  });

  it('should upload a handwriting PNG and return its filename', async () => {
    const res = await request(app)
      .post('/api/handwriting')
      .auth(staffCredentials.name, staffCredentials.pass)
      .attach('handwriting', testPngPath);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('filename');
    expect(res.body.filename).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.png$/);

    // Verify the file exists on disk
    const uploadedFilePath = path.join(__dirname, '..', '..', 'data', 'png', res.body.filename);
    expect(fs.existsSync(uploadedFilePath)).toBe(true);

    // Clean up the uploaded file
    fs.unlinkSync(uploadedFilePath);
  });
});

describe('Reservations API - Handwriting Cleanup', () => {
  const testPngPath = path.join(__dirname, 'test_delete.png');
  let reservationId;
  let handwritingFilename;

  beforeEach(async () => {
    // Create a dummy PNG file for testing deletion
    fs.writeFileSync(testPngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]));

    // Upload the PNG and create a reservation with it
    const uploadRes = await request(app)
      .post('/api/handwriting')
      .auth(staffCredentials.name, staffCredentials.pass)
      .attach('handwriting', testPngPath);

    handwritingFilename = uploadRes.body.filename;

    const newReservation = {
      date: '2025-07-17',
      time_min: 700,
      column_index: 3,
      patient_name: null,
      handwriting: handwritingFilename,
    };

    const res = await request(app)
      .post('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass)
      .send(newReservation);

    reservationId = res.body.id;
  });

  afterEach(() => {
    // Clean up the dummy PNG file
    if (fs.existsSync(testPngPath)) {
      fs.unlinkSync(testPngPath);
    }
    // Ensure the uploaded file is cleaned up if test fails before deletion
    const uploadedFilePath = path.join(__dirname, '..', '..', 'data', 'png', handwritingFilename);
    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
  });

  it('should delete a reservation and its associated handwriting PNG', async () => {
    const uploadedFilePath = path.join(__dirname, '..', '..', 'data', 'png', handwritingFilename);
    expect(fs.existsSync(uploadedFilePath)).toBe(true); // Ensure file exists before deletion

    const res = await request(app)
      .delete(`/api/reservations/${reservationId}`)
      .auth(staffCredentials.name, staffCredentials.pass);

    expect(res.statusCode).toEqual(204);

    // Verify the reservation is deleted from DB
    const deletedReservation = await db('reservations').where({ id: reservationId }).first();
    expect(deletedReservation).toBeUndefined();

    // Verify the PNG file is deleted from disk
    expect(fs.existsSync(uploadedFilePath)).toBe(false);
  });
});