import { Router } from 'express';
import db from '../lib/db';
import { authenticate, authorize } from '../middleware/auth';
import { HolidayType } from '@shared/types/domain';

const router = Router();

// GET /api/holidays - Get all holiday settings
router.get('/', authenticate, async (req, res, next) => {
  try {
    const holidays = await db('holidays').select('*');
    res.json(holidays);
  } catch (error) {
    next(error);
  }
});

// POST /api/holidays - Create or update a holiday setting
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { type, date, day_of_week, name } = req.body;

    if (!type || !name) {
      return res.status(400).json({ message: 'Type and name are required.' });
    }

    if (type === HolidayType.SPECIFIC_DATE && !date) {
      return res.status(400).json({ message: 'Date is required for specific date holidays.' });
    }
    if (type === HolidayType.RECURRING_DAY && (day_of_week === undefined || day_of_week === null)) {
      return res.status(400).json({ message: 'Day of week is required for recurring day holidays.' });
    }

    const [id] = await db('holidays').insert({ type, date, day_of_week, name }).returning('id');
    const newHoliday = await db('holidays').where({ id }).first();
    res.status(201).json(newHoliday);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/holidays/:id - Delete a holiday setting
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedCount = await db('holidays').where({ id }).del();
    if (deletedCount === 0) {
      return res.status(404).json({ message: 'Holiday not found.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
