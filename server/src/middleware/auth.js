const auth = require('basic-auth');
const bcrypt = require('bcrypt');
const { db } = require('../lib');

// Authentication Middleware
const authenticate = async (req, res, next) => {
  const credentials = auth(req);

  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Dental Scheduler"');
    return res.status(401).send('Authentication required.');
  }

  try {
    const user = await db('users').where({ username: credentials.name }).first();

    if (!user || !(await bcrypt.compare(credentials.pass, user.password_hash))) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Dental Scheduler"');
      return res.status(401).send('Invalid credentials.');
    }

    req.user = user; // Attach user to request
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// Authorization Middleware
const authorize = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
};
