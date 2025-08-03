import dotenv from 'dotenv';
<<<<<<< HEAD
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
=======
   import express from 'express';
   import cors from 'cors';
   import path from 'path';
   import { fileURLToPath } from 'url';
   import bcrypt from 'bcrypt';
   import jwt from 'jsonwebtoken';
   import multer from 'multer';
   import { v4 as uuidv4 } from 'uuid';
   import history from 'connect-history-api-fallback';
   import fs from 'fs';
   import { body, validationResult } from 'express-validator';
   import cookieParser from 'cookie-parser';
   import { db, initializeDatabase } from './db.js';

   // Define __dirname and __filename for ESM modules
   const __filename = fileURLToPath(import.meta.url);
   const __dirname = path.dirname(__filename);
>>>>>>> c3d83d0 (Push full project files)

   // Load environment variables
   const envPath = path.resolve(__dirname, '.env');
   if (fs.existsSync(envPath)) {
     dotenv.config({ path: envPath });
     console.log(`✅ Loaded .env file from ${envPath}`);
   } else {
     console.error(`❌ No .env file found at ${envPath}`);
     process.exit(1);
   }

<<<<<<< HEAD
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
=======
   // Initialize Express app
   const app = express();
   const port = process.env.PORT || 5001;

   // Fallback JWT secret in development
   if (!process.env.JWT_SECRET) {
     process.env.JWT_SECRET = 'your-secret-key-here-change-in-production';
     console.log('⚠️ Using default JWT_SECRET - change in production');
   }

   // Request logging middleware
   app.use((req, res, next) => {
     const start = Date.now();
     console.log(`📥 Incoming request: ${req.method} ${req.url}`);
     res.on('finish', () => {
       const duration = Date.now() - start;
       console.log(`📤 Response: ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
     });
     next();
   });

   // Core middleware
   app.use(express.json({ limit: '10mb' }));
   app.use(express.urlencoded({ extended: true, limit: '10mb' }));
   app.use(cookieParser());

   // CORS configuration
   const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5001'];
   app.use(cors({
     origin: function (origin, callback) {
       if (!origin || allowedOrigins.includes(origin)) {
         callback(null, true);
       } else {
         console.error('❌ CORS blocked for origin:', origin);
         callback(new Error('Not allowed by CORS'));
       }
     },
     methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-Signup'],
     credentials: true,
   }));

   // Content Security Policy
   app.use((req, res, next) => {
     if (!req.path.startsWith('/api')) {
       res.setHeader(
         'Content-Security-Policy',
         [
           "default-src 'self'",
           `connect-src 'self' ${allowedOrigins.join(' ')}`,
           "style-src 'self' 'unsafe-inline'",
           "script-src 'self' 'unsafe-inline'",
           "img-src 'self' data: blob:",
           "font-src 'self'",
           "frame-src 'self'",
         ].join('; ')
       );
     }
     next();
   });

   // Authentication middleware
   function authenticateToken(req, res, next) {
     const authHeader = req.headers['authorization'];
     const headerToken = authHeader && authHeader.split(' ')[1];
     const cookieToken = req.cookies?.token;
     const token = cookieToken || headerToken;

     if (!token) {
       console.log('❌ No token provided');
       return res.status(401).json({ message: 'Access denied. No token provided.' });
     }
     jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
       if (err) {
         console.log('❌ Token verification failed:', err.message);
         return res.status(403).json({ message: err.name === 'TokenExpiredError' ? 'Token expired. Please log in again.' : 'Invalid token.' });
       }
       req.user = user;
       next();
     });
   }

   // File upload storage for avatars
   const uploadDir = path.join(__dirname, 'Uploads', 'avatars');
   if (!fs.existsSync(uploadDir)) {
     fs.mkdirSync(uploadDir, { recursive: true });
   }
   const storage = multer.diskStorage({
     destination: (req, file, cb) => cb(null, uploadDir),
     filename: (req, file, cb) => {
       const userId = req.params.userId || uuidv4();
       const fileExt = path.extname(file.originalname);
       cb(null, `avatar-${userId}${fileExt}`);
     },
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
     },
   });

   // Rate limiting for login attempts
   const loginAttempts = new Map();
   setInterval(() => loginAttempts.clear(), 60 * 60 * 1000);

   // API Routes
   app.get('/api/health', (req, res) => {
     res.status(200).json({ uptime: process.uptime(), status: 'OK', timestamp: new Date().toISOString() });
   });

   app.get('/api/health/db', async (req, res) => {
     try {
       const result = await db.pool.query('SELECT NOW()');
       res.json({ status: 'Database connected', timestamp: result.rows[0].now });
     } catch (error) {
       console.error('❌ Database health check error:', error.message);
       res.status(500).json({ status: 'Database connection failed', error: error.message });
     }
   });

   app.post('/api/signup', [
     body('full_name').trim().notEmpty().withMessage('Full name is required'),
     body('username').trim().notEmpty().withMessage('Username is required'),
     body('email').isEmail().withMessage('Valid email is required'),
     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
   ], async (req, res) => {
     try {
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       const settings = await db.getSettings();
       if (settings && settings.allowNewUsers === false) {
         return res.status(403).json({ message: 'Registrations are disabled.' });
       }
       const user = await db.createUser(req.body);
       res.status(201).json({ user });
     } catch (error) {
       console.error('❌ Error in signup:', error.message);
       res.status(500).json({ message: 'Server error creating user', error: error.message });
     }
   });

   app.post('/api/users', [
     body('full_name').trim().notEmpty().withMessage('Full name is required'),
     body('username').trim().notEmpty().withMessage('Username is required'),
     body('email').isEmail().withMessage('Valid email is required'),
     body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
     authenticateToken,
   ], async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       const user = await db.createUser(req.body);
       res.status(201).json(user);
     } catch (error) {
       console.error('❌ Error creating user:', error.message);
       res.status(500).json({ message: 'Server error creating user', error: error.message });
     }
   });

   app.post('/api/users/:userId/verify-pin', authenticateToken, async (req, res) => {
     try {
       const { pin } = req.body;
       const { userId } = req.params;
       if (!pin || typeof pin !== 'string') {
         return res.status(400).json({ message: 'PIN is required and must be a string.' });
       }
       const user = await db.getUserById(userId);
       if (!user || !user.pin) {
         return res.status(404).json({ message: 'User or PIN not found.' });
       }
       const isValid = await bcrypt.compare(pin, user.pin);
       res.json({ valid: isValid });
     } catch (error) {
       console.error('❌ Error verifying PIN:', error.message);
       res.status(500).json({ message: 'Server error verifying PIN', error: error.message });
     }
   });

   app.get('/api/users', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       const users = await db.getUsers();
       res.json(users);
     } catch (error) {
       console.error('❌ Error fetching users:', error.message);
       res.status(500).json({ message: 'Server error fetching users', error: error.message });
     }
   });

   app.delete('/api/users/:id', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       await db.deleteUser(req.params.id);
       res.json({ message: 'User deleted successfully' });
     } catch (error) {
       console.error('❌ Error deleting user:', error.message);
       res.status(500).json({ message: 'Server error deleting user', error: error.message });
     }
   });

   app.patch('/api/users/:id/status', authenticateToken, [
     body('status').isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive'),
   ], async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       const user = await db.updateUserStatus(req.params.id, req.body.status);
       res.json(user);
     } catch (error) {
       console.error('❌ Error updating user status:', error.message);
       res.status(500).json({ message: 'Server error updating user status', error: error.message });
     }
   });

   app.patch('/api/users/:id/balance', authenticateToken, [
     body('balance').isFloat({ min: 0 }).withMessage('Balance must be a positive number'),
   ], async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       const user = await db.updateUserBalance(req.params.id, req.body.balance);
       res.json(user);
     } catch (error) {
       console.error('❌ Error updating user balance:', error.message);
       res.status(500).json({ message: 'Server error updating user balance', error: error.message });
     }
   });

   app.post('/api/login', [
     body('username').trim().notEmpty().withMessage('Username is required'),
     body('password').notEmpty().withMessage('Password is required'),
   ], async (req, res) => {
     const ip = req.ip;
     const attempts = loginAttempts.get(ip) || 0;
     if (attempts >= 5) {
       return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
     }
     try {
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       const { username, password } = req.body;
       const user = await db.getUserByUsername(username);
       if (!user || user.status !== 'Active') {
         loginAttempts.set(ip, attempts + 1);
         return res.status(401).json({ message: 'Invalid username or password.' });
       }
       const validPassword = await bcrypt.compare(password, user.password);
       if (!validPassword) {
         loginAttempts.set(ip, attempts + 1);
         return res.status(401).json({ message: 'Invalid username or password.' });
       }
       loginAttempts.delete(ip);
       await db.updateUserLastLogin(user.id);
       const token = jwt.sign(
         { id: user.id, username: user.username, isAdmin: user.is_admin },
         process.env.JWT_SECRET,
         { expiresIn: '1h' },
       );
       res.cookie('token', token, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'Strict',
         maxAge: 60 * 60 * 1000,
       });
       res.json({
         user: {
           id: user.id,
           username: user.username,
           fullName: user.full_name,
           email: user.email,
           isAdmin: user.is_admin,
           avatar: user.avatar,
         },
       });
     } catch (error) {
       console.error('❌ Login error:', error.message);
       res.status(500).json({ message: 'Server error during login', error: error.message });
     }
   });

   app.post('/api/logout', authenticateToken, async (req, res) => {
     try {
       res.clearCookie('token', { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production' });
       res.json({ message: 'Logged out successfully' });
     } catch (error) {
       console.error('❌ Logout error:', error.message);
       res.status(500).json({ message: 'Server error during logout' });
     }
   });

   app.get('/api/me', authenticateToken, async (req, res) => {
     try {
       const user = await db.getUserById(req.user.id);
       if (!user) {
         return res.status(404).json({ message: 'User not found' });
       }
       res.json({
         user: {
           id: user.id,
           username: user.username,
           fullName: user.full_name,
           email: user.email,
           balance: user.balance,
           isAdmin: user.is_admin,
           avatar: user.avatar,
         },
       });
     } catch (error) {
       console.error('❌ Error fetching current user:', error.message);
       res.status(500).json({ message: 'Server error fetching user data' });
     }
   });

   app.get('/api/session', authenticateToken, async (req, res) => {
     try {
       res.json({ isLoggedIn: true });
     } catch (error) {
       console.error('❌ Session check error:', error.message);
       res.status(500).json({ message: 'Server error checking session' });
     }
   });

   app.post('/api/transactions', authenticateToken, [
     body('user_id').notEmpty().withMessage('User ID is required'),
     body('type').isIn(['Deposit', 'Withdrawal', 'Transfer', 'Bill Pay']).withMessage('Valid transaction type is required'),
     body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
     body('date_time').isISO8601().withMessage('Valid date and time is required'),
   ], async (req, res) => {
     try {
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       if (!req.user.isAdmin && req.body.user_id !== req.user.id) {
         return res.status(403).json({ message: 'You can only create transactions for your own account' });
       }
       const transaction = await db.createTransaction(req.body);
       res.status(201).json(transaction);
     } catch (error) {
       console.error('❌ Error creating transaction:', error.message);
       res.status(500).json({ message: 'Server error creating transaction', error: error.message });
     }
   });

   app.get('/api/transactions', authenticateToken, async (req, res) => {
     try {
       if (req.user.isAdmin) {
         const transactions = await db.getTransactions();
         res.json(transactions);
       } else {
         const transactions = await db.getUserTransactions(req.user.id);
         res.json(transactions);
       }
     } catch (error) {
       console.error('❌ Error fetching transactions:', error.message);
       res.status(500).json({ message: 'Server error fetching transactions', error: error.message });
     }
   });

   app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       const result = await db.deleteTransaction(req.params.id);
       res.json(result);
     } catch (error) {
       console.error('❌ Error deleting transaction:', error.message);
       res.status(500).json({ message: 'Server error deleting transaction', error: error.message });
     }
   });

   app.get('/api/settings', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       const settings = await db.getSettings();
       res.json(settings);
     } catch (error) {
       console.error('❌ Error fetching settings:', error.message);
       res.status(500).json({ message: 'Server error fetching settings', error: error.message });
     }
   });

   app.patch('/api/settings', authenticateToken, [
     body('systemName').notEmpty().withMessage('System name is required'),
     body('maintenance').isBoolean().withMessage('Maintenance must be a boolean'),
     body('allowNewUsers').isBoolean().withMessage('AllowNewUsers must be a boolean'),
     body('contactEmail').isEmail().withMessage('Valid contact email is required'),
   ], async (req, res) => {
     try {
       if (!req.user.isAdmin) {
         return res.status(403).json({ message: 'Admin access required' });
       }
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({ errors: errors.array() });
       }
       const settings = await db.updateSettings(req.body);
       res.json(settings);
     } catch (error) {
       console.error('❌ Error updating settings:', error.message);
       res.status(500).json({ message: 'Server error updating settings', error: error.message });
     }
   });

   app.get('/api/users/:id', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin && req.params.id !== req.user.id) {
         return res.status(403).json({ message: 'You can only access your own user details' });
       }
       const user = await db.getUserById(req.params.id);
       if (!user) {
         return res.status(404).json({ message: 'User not found' });
       }
       res.json({
         id: user.id,
         username: user.username,
         fullName: user.full_name,
         email: user.email,
         phone: user.phone,
         status: user.status,
         balance: user.balance,
         isAdmin: user.is_admin,
         avatar: user.avatar,
         created_at: user.created_at,
         last_login: user.last_login,
       });
     } catch (error) {
       console.error('❌ Error fetching user by ID:', error.message);
       res.status(500).json({ message: 'Server error fetching user', error: error.message });
     }
   });

   app.get('/api/users/:userId/transactions', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin && req.params.userId !== req.user.id) {
         return res.status(403).json({ message: 'You can only access your own transactions' });
       }
       const transactions = await db.getUserTransactions(req.params.userId);
       res.json(transactions);
     } catch (error) {
       console.error('❌ Error fetching user transactions:', error.message);
       res.status(500).json({ message: 'Server error fetching transactions', error: error.message });
     }
   });

   app.patch('/api/users/:id/avatar', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin && req.params.id !== req.user.id) {
         return res.status(403).json({ message: 'You can only update your own avatar' });
       }
       const { avatar } = req.body;
       if (!avatar) {
         return res.status(400).json({ message: 'Avatar data is required' });
       }
       const user = await db.updateUserAvatar(req.params.id, avatar);
       res.json({
         message: 'Avatar updated successfully',
         avatar: user.avatar,
       });
     } catch (error) {
       console.error('❌ Error updating user avatar:', error.message);
       res.status(500).json({ message: 'Server error updating avatar', error: error.message });
     }
   });

   app.delete('/api/users/:id/avatar', authenticateToken, async (req, res) => {
     try {
       if (!req.user.isAdmin && req.params.id !== req.user.id) {
         return res.status(403).json({ message: 'You can only delete your own avatar' });
       }
       await db.deleteUserAvatar(req.params.id);
       res.json({ message: 'Avatar deleted successfully' });
     } catch (error) {
       console.error('❌ Error deleting user avatar:', error.message);
       res.status(500).json({ message: 'Server error deleting avatar', error: error.message });
     }
   });

   // Static files and SPA fallback
   const staticDir = path.join(__dirname, 'dist');
   app.use('/uploads/avatars', express.static(uploadDir));
   app.use(express.static(staticDir));
   app.use(history({
     rewrites: [
       { from: /^\/api\/.*/, to: (context) => context.parsedUrl.path },
       { from: /^\/Uploads\/.*/, to: (context) => context.parsedUrl.path },
       { from: /.*/, to: () => '/index.html' },
     ],
   }));
   app.get('*', (req, res) => {
     const indexPath = path.join(__dirname, 'dist', 'index.html');
     if (fs.existsSync(indexPath)) {
       res.sendFile(indexPath);
     } else {
       res.status(404).send('Cannot GET / - Frontend assets not found');
     }
   });

   // Error handler
   app.use((err, req, res, next) => {
     console.error('❌ Server error:', { message: err.message, path: req.path, method: req.method });
     res.status(500).json({ message: 'An unexpected error occurred', error: err.message });
   });

   // Start server
   async function startServer() {
     try {
       await initializeDatabase();
       console.log('✅ Database initialized');
       const result = await db.pool.query('SELECT NOW()');
       console.log('✅ Database connection verified:', result.rows[0].now);
       const adminUser = await db.getUserByUsername('admin');
       if (!adminUser) {
         console.log('🛠 Creating default admin user...');
         await db.createUser({
           username: 'admin',
           password: process.env.ADMIN_PASSWORD || 'admin123',
           full_name: 'System Administrator',
           email: 'admin@example.com',
           is_admin: true,
         });
         console.log('✅ Admin user created');
       }
       app.listen(port, '0.0.0.0', () => {
         console.log(`🚀 Server running on http://0.0.0.0:${port}`);
       });
       setInterval(async () => {
         try {
           await db.pool.query('SELECT NOW()');
         } catch (err) {
           console.error('❌ Keep-alive query failed:', err.message);
         }
       }, 4 * 60 * 1000);
     } catch (error) {
       console.error('❌ Failed to start server:', error.message);
       process.exit(1);
     }
   }
   startServer();
>>>>>>> c3d83d0 (Push full project files)
