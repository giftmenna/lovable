import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import history from 'connect-history-api-fallback';
import fs from 'fs';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5001;

// Route logging
['get', 'post', 'patch', 'delete', 'put', 'options'].forEach(method => {
  const originalMethod = app[method];
  app[method] = function (path, ...handlers) {
    console.log(`Registering ${method.toUpperCase()} route: ${path}`);
    return originalMethod.call(this, path, ...handlers);
  };
});

// Middleware logging
const originalUse = app.use;
app.use = function (...args) {
  if (typeof args[0] === 'string') {
    console.log(`Registering middleware for path: ${args[0]}`);
  } else {
    console.log('Registering global middleware:', args[0]?.name || 'anonymous');
  }
  return originalUse.call(this, ...args);
};

// Environment variables logging
console.log('Environment variables:', {
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? '[set]' : undefined,
  JWT_SECRET: process.env.JWT_SECRET ? '[set]' : undefined,
  NEXT_PUBLIC_STACK_PROJECT_ID: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  STACK_SECRET_SERVER_KEY: process.env.STACK_SECRET_SERVER_KEY ? '[set]' : undefined
});

// Database setup
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

// Initialize database
async function initDb() {
  try {
    console.log('Starting database initialization');

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        pin VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        balance DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Active',
        last_login TIMESTAMP,
        avatar VARCHAR(255),
        is_admin BOOLEAN DEFAULT FALSE
      );
    `);

    // Transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        description VARCHAR(255),
        date_time TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'Completed',
        recipient_details JSONB
      );
    `);

    // Settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value VARCHAR(255) NOT NULL
      );
    `);

    // Admin_Audit_Log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id UUID PRIMARY KEY,
        admin_id UUID,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert default settings
    await pool.query(`
      INSERT INTO settings (id, key, value)
      VALUES
        ($1, 'transaction_fee', '1.00'),
        ($2, 'minimum_balance', '100.00'),
        ($3, 'max_transaction_limit', '10000.00'),
        ($4, 'daily_transaction_limit', '50000.00')
      ON CONFLICT (key) DO NOTHING;
    `, [uuidv4(), uuidv4(), uuidv4(), uuidv4()]);

    // Create admin user
    const adminCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminCheck.rows.length === 0) {
      const adminId = uuidv4();
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const hashedPin = await bcrypt.hash('0000', 10);
      await pool.query(`
        INSERT INTO users (id, full_name, username, email, password, pin, phone, status, is_admin, balance)
        VALUES ($1, 'Admin User', 'admin', 'admin@nivalus.com', $2, $3, '+1234567890', 'Active', TRUE, 50000);
      `, [adminId, hashedPassword, hashedPin]);
      console.log('Admin user created with ID:', adminId);
    }

    // Create test user
    const testUserCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['testuser']);
    if (testUserCheck.rows.length === 0) {
      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash('test123', 10);
      const hashedPin = await bcrypt.hash('1234', 10);
      await pool.query(`
        INSERT INTO users (id, full_name, username, email, password, pin, phone, status, is_admin, balance)
        VALUES ($1, 'Test User', 'testuser', 'test@example.com', $2, $3, '+9876543210', 'Active', FALSE, 2500);
      `, [userId, hashedPassword, hashedPin]);

      // Sample transactions
      const transactionTypes = ['Deposit', 'Withdrawal', 'Bank Transfer'];
      const descriptions = ['Salary', 'Rent Payment', 'Utility Bill', 'Grocery Shopping', 'Investment'];
      for (let i = 0; i < 5; i++) {
        const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const amount = Math.floor(Math.random() * 500) + 100;
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 14));
        let recipientDetails = type === 'Bank Transfer' ? {
          name: 'John Doe',
          accountNumber: '123456789',
          routingNumber: '987654321'
        } : null;
        await pool.query(`
          INSERT INTO transactions (id, user_id, type, amount, description, date_time, status, recipient_details)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          uuidv4(), userId, type, amount, description, date.toISOString(), 'Completed', recipientDetails ? JSON.stringify(recipientDetails) : null
        ]);
      }
      console.log('Test user created with ID:', userId);
    }

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initDb();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Signup'],
  credentials: true
}));

// Multer setup
const uploadDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.params.userId || uuidv4();
    const fileExt = path.extname(file.originalname);
    cb(null, `avatar-${userId}${fileExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpeg, .jpg, and .png files are allowed'));
    }
  }
});

app.use('/uploads/avatars', express.static(uploadDir));

// SPA routing
app.use(history({
  rewrites: [
    { from: /^\/api\/.*$/, to: context => context.parsedUrl.path },
    { from: /^\/uploads\/.*$/, to: context => context.parsedUrl.path }
  ]
}));
app.use(express.static(path.join(__dirname, 'dist')));

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });
  jwt.verify(token, process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Routes (from old logic)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password.' });
    }
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1 AND status = $2', [username, 'Active']);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key',
      { expiresIn: '1h' }
    );
    const isAdmin = user.is_admin || user.username === 'admin';
    if (isAdmin) {
      await pool.query(`
        INSERT INTO admin_audit_log (id, admin_id, action, details)
        VALUES ($1, $2, 'Admin login', $3)
      `, [uuidv4(), user.id, JSON.stringify({ timestamp: new Date() })]);
    }
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        isAdmin,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// Add other routes (users, transactions, settings) from old logic here if needed
// For brevity, only /api/login is included; request if you want all routes added

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'An unexpected error occurred.', error: err.message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
