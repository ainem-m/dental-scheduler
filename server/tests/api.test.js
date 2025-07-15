const request = require('supertest');
const { app, server, io, startServer } = require('../src/index'); // Import startServer
const db = require('../src/db');
const bcrypt = require('bcrypt');

let adminCredentials;
let staffCredentials;

beforeAll(async () => {
  console.log('beforeAll: Starting test setup...');
  // Start the server explicitly for tests
  await new Promise(resolve => startServer(0, resolve)); // Use port 0 for ephemeral port
  console.log('Server started for tests.');

  // Create test users for authentication
  await db('users').del(); // Clear existing users
  const adminPasswordHash = await bcrypt.hash('adminpass', 10);
  await db('users').insert({
    username: 'testadmin',
    password_hash: adminPasswordHash,
    role: 'admin',
  });
  adminCredentials = { name: 'testadmin', pass: 'adminpass' };

  const staffPasswordHash = await bcrypt.hash('staffpass', 10);
  await db('users').insert({
    username: 'teststaff',
    password_hash: staffPasswordHash,
    role: 'staff',
  });
  staffCredentials = { name: 'teststaff', pass: 'staffpass' };
  console.log('beforeAll: Test setup complete.');
});

afterAll(async (done) => {
  console.log('afterAll: Closing server, socket.io, and DB connection...');
  // Close server and socket.io
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => io.close(resolve));
  // Destroy database connection
  await db.destroy();
  console.log('afterAll: All resources closed.');
  done();
});

describe('Authentication and Authorization', () => {
  console.log('Describe: Authentication and Authorization');
  it('should return 401 for unauthenticated access to /api/reservations', async () => {
    console.log('Test: 401 for unauthenticated access');
    const res = await request(app).get('/api/reservations');
    expect(res.statusCode).toEqual(401);
  });

  it('should allow authenticated staff to access /api/reservations', async () => {
    console.log('Test: Staff access to reservations');
    const res = await request(app)
      .get('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass);
    expect(res.statusCode).toEqual(200);
  });

  it('should allow authenticated admin to access /api/reservations', async () => {
    console.log('Test: Admin access to reservations');
    const res = await request(app)
      .get('/api/reservations')
      .auth(adminCredentials.name, adminCredentials.pass);
    expect(res.statusCode).toEqual(200);
  });

  it('should return 403 for staff trying to access /api/users', async () => {
    console.log('Test: Staff forbidden from users API');
    const res = await request(app)
      .get('/api/users')
      .auth(staffCredentials.name, staffCredentials.pass);
    expect(res.statusCode).toEqual(403);
  });

  it('should allow admin to access /api/users', async () => {
    console.log('Test: Admin access to users API');
    const res = await request(app)
      .get('/api/users')
      .auth(adminCredentials.name, adminCredentials.pass);
    expect(res.statusCode).toEqual(200);
  });
});

describe('Reservations API', () => {
  console.log('Describe: Reservations API');
  beforeEach(async () => {
    console.log('beforeEach: Clearing reservations...');
    await db('reservations').del();
  });

  it('should return an empty array when no reservations exist', async () => {
    console.log('Test: Empty reservations array');
    const res = await request(app)
      .get('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]);
  });

  it('should return reservations when they exist', async () => {
    console.log('Test: Existing reservations');
    await db('reservations').insert({
      date: '2025-07-15',
      time_min: 540,
      column_index: 1,
      patient_name: 'Test Patient'
    });

    const res = await request(app)
      .get('/api/reservations')
      .auth(staffCredentials.name, staffCredentials.pass);
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].patient_name).toBe('Test Patient');
  });

  it('should create a new reservation', async () => {
    console.log('Test: Create new reservation');
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
    const reservationsInDb = await db('reservations').where({ patient_name: 'New Patient' });
    expect(reservationsInDb.length).toBe(1);
  });

  it('should update an existing reservation', async () => {
    console.log('Test: Update existing reservation');
    const [id] = await db('reservations').insert({
      date: '2025-07-17',
      time_min: 700,
      column_index: 3,
      patient_name: 'Patient to Update'
    });

    const updatedData = {
      date: '2025-07-17',
      time_min: 700,
      column_index: 3,
      patient_name: 'Updated Patient Name'
    };

    const res = await request(app)
      .put(`/api/reservations/${id}`)
      .auth(staffCredentials.name, staffCredentials.pass)
      .send(updatedData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.patient_name).toBe('Updated Patient Name');
    const reservationInDb = await db('reservations').where({ id }).first();
    expect(reservationInDb.patient_name).toBe('Updated Patient Name');
  });

  it('should delete a reservation', async () => {
    console.log('Test: Delete reservation');
    const [id] = await db('reservations').insert({
      date: '2025-07-18',
      time_min: 800,
      column_index: 4,
      patient_name: 'Patient to Delete'
    });

    const res = await request(app)
      .delete(`/api/reservations/${id}`)
      .auth(staffCredentials.name, staffCredentials.pass);

    expect(res.statusCode).toEqual(204);
    const reservationInDb = await db('reservations').where({ id }).first();
    expect(reservationInDb).toBeUndefined();
  });
});

describe('User Management API (Admin Only)', () => {
  console.log('Describe: User Management API');
  beforeEach(async () => {
    console.log('beforeEach: Ensuring testadmin exists...');
    // Ensure testadmin exists for these tests
    const existingAdmin = await db('users').where({ username: 'testadmin' }).first();
    if (!existingAdmin) {
      const adminPasswordHash = await bcrypt.hash('adminpass', 10);
      await db('users').insert({
        username: 'testadmin',
        password_hash: adminPasswordHash,
        role: 'admin',
      });
    }
  });

  it('should create a new user (admin only)', async () => {
    console.log('Test: Create new user');
    const newUser = {
      username: 'newuser',
      password: 'newpass',
      role: 'staff',
    };
    const res = await request(app)
      .post('/api/users')
      .auth(adminCredentials.name, adminCredentials.pass)
      .send(newUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body.username).toBe('newuser');
    expect(res.body.role).toBe('staff');
    const userInDb = await db('users').where({ username: 'newuser' }).first();
    expect(userInDb).toBeDefined();
    expect(await bcrypt.compare('newpass', userInDb.password_hash)).toBe(true);
  });

  it('should get all users (admin only)', async () => {
    console.log('Test: Get all users');
    const res = await request(app)
      .get('/api/users')
      .auth(adminCredentials.name, adminCredentials.pass);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // testadmin and teststaff
    expect(res.body.some(u => u.username === 'testadmin')).toBe(true);
  });

  it('should update a user (admin only)', async () => {
    console.log('Test: Update user');
    const [id] = await db('users').insert({
      username: 'user_to_update',
      password_hash: await bcrypt.hash('oldpass', 10),
      role: 'staff',
    });

    const updatedData = {
      username: 'updated_user',
      role: 'admin',
      password: 'newsecurepass',
    };

    const res = await request(app)
      .put(`/api/users/${id}`)
      .auth(adminCredentials.name, adminCredentials.pass)
      .send(updatedData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.username).toBe('updated_user');
    expect(res.body.role).toBe('admin');

    const userInDb = await db('users').where({ id }).first();
    expect(userInDb.username).toBe('updated_user');
    expect(userInDb.role).toBe('admin');
    expect(await bcrypt.compare('newsecurepass', userInDb.password_hash)).toBe(true);
  });

  it('should delete a user (admin only)', async () => {
    console.log('Test: Delete user');
    const [id] = await db('users').insert({
      username: 'user_to_delete',
      password_hash: await bcrypt.hash('deletepass', 10),
      role: 'staff',
    });

    const res = await request(app)
      .delete(`/api/users/${id}`)
      .auth(adminCredentials.name, adminCredentials.pass);

    expect(res.statusCode).toEqual(204);
    const userInDb = await db('users').where({ id }).first();
    expect(userInDb).toBeUndefined();
  });
});