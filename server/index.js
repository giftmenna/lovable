import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Configure dotenv
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5001;

// Log all registered routes for debugging
app.use((req, res, next) => {
  console.log(`Registering route: ${req.method} ${req.path}`);
  next();
});

// Serve Vite-built static files
app.use(express.static(path.join(__dirname, 'dist')));

// CORS configuration
const corsOptions = process.env.NODE_ENV === 'production'
  ? { origin: process.env.CORS_ORIGIN || false }
  : {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Signup'],
      credentials: true
    };
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Multer configuration for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.params.userId;
    const fileExt = path.extname(file.originalname);
    cb(null, `avatar-${userId}${fileExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpeg, .jpg, and .png files are allowed'));
    }
  }
});

// Serve static avatar files
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars')));

// Database connection
console.log('Setting up database connection with URI:', process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully:', res.rows[0]);
  }
});

// Initialize database (same as provided)
const initDb = async () => {
  try {
    console.log('Starting database initialization');
    // ... (rest of the initDb function as provided)
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};
initDb();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });
  jwt.verify(token, process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};
// Routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password.' });
    }
    
    console.log('Login attempt for username:', username);
    
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1 AND status = $2', [username, 'Active']);
    
    if (userResult.rows.length === 0) {
      console.log('User not found or inactive:', username);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    
    const user = userResult.rows[0];
    console.log('User found:', user.username);
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    
    console.log('Password valid for user:', username);
    
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key',
      { expiresIn: '1h' }
    );
    
    const isAdmin = user.is_admin === true || user.username === 'admin';
    
    if (isAdmin) {
      await pool.query(`
        INSERT INTO admin_audit_log (id, admin_id, action, details)
        VALUES ($1, $2, 'Admin login', $3)
      `, [uuidv4(), user.id, JSON.stringify({ timestamp: new Date() })]);
    }
    
    console.log('Login successful for user:', username, 'isAdmin:', isAdmin);
    
    res.json({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        isAdmin: isAdmin,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    console.log('Getting all users');
    const result = await pool.query('SELECT * FROM users ORDER BY username');
    console.log(`Found ${result.rows.length} users`);
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while retrieving users.' });
  }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.id !== id && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = result.rows[0];
    delete user.password;
    delete user.pin;
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error while retrieving user.' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    console.log('Create user request received:', req.body);
    
    const isSignupRequest = req.body.isSignup === true || req.headers['x-signup'] === 'true';
    const isAdminRequest = req.headers.authorization && jwt.verify(
      req.headers.authorization.split(' ')[1], 
      process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key'
    ).username === 'admin';
    
    if (!isSignupRequest && !isAdminRequest) {
      return res.status(403).json({ message: 'Access denied. Admin only or signup required.' });
    }
    
    const { full_name, username, email, password, pin, phone } = req.body;
    
    if (!full_name || !username || !email || !password || !pin) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }
    
    const checkResult = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10);
    const userId = uuidv4();
    
    await pool.query(`
      INSERT INTO users (id, full_name, username, email, password, pin, phone, balance, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [userId, full_name, username, email, hashedPassword, hashedPin, phone || '', 0, 'Active']);
    
    console.log('User created successfully:', { username, id: userId });
    
    if (isAdminRequest) {
      const adminId = jwt.verify(
        req.headers.authorization.split(' ')[1], 
        process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key'
      ).id;
      
      await pool.query(`
        INSERT INTO admin_audit_log (id, admin_id, action, details)
        VALUES ($1, $2, 'Created user', $3)
      `, [uuidv4(), adminId, JSON.stringify({ username })]);
    }
    
    res.status(201).json({ 
      message: `User ${username} created successfully.`,
      user: {
        id: userId,
        username,
        full_name,
        email,
        phone
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error while creating user.' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    await pool.query(`
      INSERT INTO admin_audit_log (id, admin_id, action, details)
      VALUES ($1, $2, 'Deleted user', $3)
    `, [uuidv4(), req.user.id, JSON.stringify({ username: user.username })]);
    
    res.json({ message: `User ${user.username} deleted successfully.` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error while deleting user.' });
  }
});

app.patch('/api/users/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || (status !== 'Active' && status !== 'Inactive')) {
      return res.status(400).json({ message: 'Invalid status. Must be Active or Inactive.' });
    }
    
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    
    await pool.query(`
      INSERT INTO admin_audit_log (id, admin_id, action, details)
      VALUES ($1, $2, 'Updated user status', $3)
    `, [uuidv4(), req.user.id, JSON.stringify({ username: user.username, status })]);
    
    res.json({ message: `User ${user.username} is now ${status}.` });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error while updating user status.' });
  }
});

app.patch('/api/users/:id/balance', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    const { balance } = req.body;
    
    if (balance === undefined || isNaN(parseFloat(balance)) || parseFloat(balance) < 0) {
      return res.status(400).json({ message: 'Invalid balance. Must be a positive number.' });
    }
    
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    const newBalance = parseFloat(balance);
    
    await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, id]);
    
    await pool.query(`
      INSERT INTO admin_audit_log (id, admin_id, action, details)
      VALUES ($1, $2, 'Updated user balance', $3)
    `, [uuidv4(), req.user.id, JSON.stringify({ username: user.username, oldBalance: user.balance, newBalance })]);
    
    res.json({ message: `Balance updated to $${newBalance.toFixed(2)} for ${user.username}.` });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ message: 'Server error while updating balance.' });
  }
});

app.post('/api/users/:userId/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatarUrl, userId]);
    
    res.json({ 
      message: 'Avatar uploaded successfully.', 
      avatarUrl 
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ message: 'Server error while uploading avatar.' });
  }
});

app.delete('/api/users/:userId/avatar', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const userResult = await pool.query('SELECT avatar FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const { avatar } = userResult.rows[0];
    
    if (avatar) {
      const avatarPath = path.join(__dirname, avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }
    
    await pool.query('UPDATE users SET avatar = NULL WHERE id = $1', [userId]);
    
    res.json({ message: 'Avatar removed successfully.' });
  } catch (error) {
    console.error('Avatar delete error:', error);
    res.status(500).json({ message: 'Server error while deleting avatar.' });
  }
});

app.post('/api/users/verify-pin', authenticateToken, async (req, res) => {
  try {
    const { userId, pin } = req.body;
    
    if (!userId || !pin) {
      return res.status(400).json({ message: 'User ID and PIN are required.' });
    }
    
    if (req.user.id !== userId && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const userResult = await pool.query('SELECT pin FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const hashedPin = userResult.rows[0].pin;
    
    const valid = await bcrypt.compare(pin, hashedPin);
    
    res.json({ valid });
  } catch (error) {
    console.error('PIN verification error:', error);
    res.status(500).json({ message: 'Server error while verifying PIN.' });
  }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    console.log('Getting all transactions');
    const result = await pool.query(`
      SELECT t.*, u.username 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.date_time DESC
    `);
    
    console.log(`Found ${result.rows.length} transactions`);
    res.json(result.rows);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error while retrieving transactions.' });
  }
});

app.get('/api/transactions/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    if (req.user.id !== userId && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const result = await pool.query(`
      SELECT * FROM transactions 
      WHERE user_id = $1 
      ORDER BY date_time DESC 
      LIMIT $2
    `, [userId, limit]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get user transactions error:', error);
    res.status(500).json({ message: 'Server error while retrieving transactions.' });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { user_id, type, amount, description, date_time, recipient_details } = req.body;
    
    if (!user_id || !type || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Invalid transaction data.' });
    }
    
    if (req.user.id !== user_id && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    const transactionAmount = parseFloat(amount);
    
    const settingsResult = await pool.query('SELECT * FROM settings WHERE key = $1 OR key = $2', 
      ['max_transaction_limit', 'minimum_balance']);
    
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = parseFloat(row.value);
    });
    
    if (transactionAmount > settings.max_transaction_limit) {
      return res.status(400).json({ 
        message: `Transaction amount exceeds maximum limit of $${settings.max_transaction_limit}.` 
      });
    }
    
    if ((type === 'Withdrawal' || type === 'Bank Transfer' || type === 'Wire Transfer' || type === 'P2P') && 
        user.balance < transactionAmount) {
      return res.status(400).json({ message: 'Insufficient balance for this transaction.' });
    }
    
    if ((type === 'Withdrawal' || type === 'Bank Transfer' || type === 'Wire Transfer' || type === 'P2P') && 
        (user.balance - transactionAmount) < settings.minimum_balance) {
      return res.status(400).json({ 
        message: `This transaction would put the account below the minimum balance of $${settings.minimum_balance}.` 
      });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const transactionId = uuidv4();
      const transactionDateTime = date_time || new Date().toISOString();
      
      await client.query(`
        INSERT INTO transactions (id, user_id, type, amount, description, date_time, status, recipient_details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        transactionId, 
        user_id, 
        type, 
        transactionAmount, 
        description || 'Transaction', 
        transactionDateTime,
        'Completed',
        recipient_details ? JSON.stringify(recipient_details) : null
      ]);
      
      let newBalance;
      if (type === 'Deposit') {
        newBalance = parseFloat(user.balance) + transactionAmount;
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user_id]);
      } else if (type === 'Withdrawal' || type === 'Bank Transfer' || type === 'Wire Transfer' || type === 'P2P') {
        newBalance = parseFloat(user.balance) - transactionAmount;
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user_id]);
      }
      
      if (req.user.username === 'admin') {
        await client.query(`
          INSERT INTO admin_audit_log (id, admin_id, action, details)
          VALUES ($1, $2, 'Created transaction', $3)
        `, [
          uuidv4(), 
          req.user.id, 
          JSON.stringify({ 
            username: user.username, 
            type, 
            amount: transactionAmount, 
            newBalance 
          })
        ]);
      }
      
      await client.query('COMMIT');
      
      res.status(201).json({ 
        message: `Transaction for ${user.username} created successfully.`,
        transaction: {
          id: transactionId,
          type,
          amount: transactionAmount,
          description: description || 'Transaction',
          date_time: transactionDateTime,
          status: 'Completed',
          recipient_details: recipient_details
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ message: 'Server error while creating transaction.' });
  }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    
    const transactionResult = await pool.query(`
      SELECT t.*, u.username, u.balance
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = $1
    `, [id]);
    
    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }
    
    const transaction = transactionResult.rows[0];
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let newBalance;
      if (transaction.type === 'Deposit') {
        newBalance = parseFloat(transaction.balance) - parseFloat(transaction.amount);
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, transaction.user_id]);
      } else if (transaction.type === 'Withdrawal' || transaction.type === 'Bank Transfer' || transaction.type === 'Wire Transfer' || transaction.type === 'P2P') {
        newBalance = parseFloat(transaction.balance) + parseFloat(transaction.amount);
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, transaction.user_id]);
      }
      
      await client.query('DELETE FROM transactions WHERE id = $1', [id]);
      
      await client.query(`
        INSERT INTO admin_audit_log (id, admin_id, action, details)
        VALUES ($1, $2, 'Deleted transaction', $3)
      `, [
        uuidv4(), 
        req.user.id, 
        JSON.stringify({ 
          transactionId: id, 
          username: transaction.username, 
          type: transaction.type, 
          amount: transaction.amount, 
          newBalance 
        })
      ]);
      
      await client.query('COMMIT');
      
      res.json({ message: `Transaction ID ${id} deleted successfully.` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ message: 'Server error while deleting transaction.' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error while retrieving settings.' });
  }
});

app.patch('/api/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { transaction_fee, minimum_balance, max_transaction_limit, daily_transaction_limit } = req.body;
    
    const settings = {
      transaction_fee: parseFloat(transaction_fee),
      minimum_balance: parseFloat(minimum_balance),
      max_transaction_limit: parseFloat(max_transaction_limit),
      daily_transaction_limit: parseFloat(daily_transaction_limit)
    };
    
    for (const [key, value] of Object.entries(settings)) {
      if (isNaN(value) || value < 0) {
        return res.status(400).json({ message: `Invalid ${key}. Must be a positive number.` });
      }
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const [key, value] of Object.entries(settings)) {
        await client.query(`
          UPDATE settings SET value = $1 WHERE key = $2
        `, [value.toFixed(2), key]);
      }
      
      await client.query(`
        INSERT INTO admin_audit_log (id, admin_id, action, details)
        VALUES ($1, $2, 'Updated settings', $3)
      `, [uuidv4(), req.user.id, JSON.stringify(settings)]);
      
      await client.query('COMMIT');
      
      res.json({ message: 'Settings updated successfully.', settings });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Server error while updating settings.' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'An unexpected error occurred.', error: err.message });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Catch-all for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${port} is already in use`);
  }
});
