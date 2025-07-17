import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../lib';
import { authorize } from '../middleware/auth';

const router = express.Router();

// All routes in this file are automatically prefixed with /api/users

// POST /api/users - Create a new user
router.post('/', authorize('admin'), async (req: Request, res: Response) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing username, password, or role.' });
  }

  try {
    const existingUser = await db('users').where({ username }).first();
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({
      username,
      password_hash,
      role,
    });
    const newUser = await db('users').where({ id }).first();
    const { password_hash: _, ...userWithoutHash } = newUser;
    res.status(201).json(userWithoutHash);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// GET /api/users - Get all users
router.get('/', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const users = await db('users').select('id', 'username', 'role');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// PUT /api/users/:id - Update a user
router.put('/:id', authorize('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  if (!username && !password && !role) {
    return res.status(400).json({ error: 'No fields provided for update.' });
  }

  try {
    const updateData: { [key: string]: any } = {};
    if (username) updateData.username = username;
    if (role) updateData.role = role;
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);
    updateData.updated_at = db.fn.now();

    const updatedRows = await db('users').where({ id: Number(id) }).update(updateData);

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser = await db('users').where({ id: Number(id) }).first();
    const { password_hash: _, ...userWithoutHash } = updatedUser;
    res.json(userWithoutHash);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deletedRows = await db('users').where({ id: Number(id) }).del();

    if (deletedRows === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

export default router;