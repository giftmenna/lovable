import 'dotenv/config';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../src/assets/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const userId = req.params.userId;
    const fileExt = path.extname(file.originalname);
    cb(null, `avatar-${userId}${fileExt}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only .jpeg, .jpg and .png files are allowed'));
    }
  }
});

// Improved database connection with error handling
console.log('Setting up database connection with URI:', process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for some PostgreSQL providers like Neon
  }
});

// Test database connection with robust error handling
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully:', res.rows[0]);
  }
});

// Initialize database with required tables
const initDb = async () => {
  try {
    console.log('Starting database initialization');
    
    // Create Users table if not exists
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
    console.log('Users table created or verified');

    // Create Transactions table if not exists
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
    console.log('Transactions table created or verified');

    // Create Settings table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value VARCHAR(255) NOT NULL
      );
    `);

    // Create Admin_Audit_Log table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id UUID PRIMARY KEY,
        admin_id UUID,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert default settings if they don't exist
    await pool.query(`
      INSERT INTO settings (id, key, value)
      VALUES
        ($1, 'transaction_fee', '1.00'),
        ($2, 'minimum_balance', '100.00'),
        ($3, 'max_transaction_limit', '10000.00'),
        ($4, 'daily_transaction_limit', '50000.00')
      ON CONFLICT (key) DO NOTHING;
    `, [uuidv4(), uuidv4(), uuidv4(), uuidv4()]);

    // Create admin user if it doesn't exist
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
    } else {
      console.log('Admin user already exists');
    }

    // Create regular test user if not exists
    const testUserCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['testuser']);
    
    if (testUserCheck.rows.length === 0) {
      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash('test123', 10);
      const hashedPin = await bcrypt.hash('1234', 10);
      
      await pool.query(`
        INSERT INTO users (id, full_name, username, email, password, pin, phone, status, is_admin, balance)
        VALUES ($1, 'Test User', 'testuser', 'test@example.com', $2, $3, '+9876543210', 'Active', FALSE, 2500);
      `, [userId, hashedPassword, hashedPin]);
      
      // Create some sample transactions for the test user
      const transactionTypes = ['Deposit', 'Withdrawal', 'Bank Transfer'];
      const descriptions = ['Salary', 'Rent Payment', 'Utility Bill', 'Grocery Shopping', 'Investment'];
      
      for (let i = 0; i < 5; i++) {
        const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const amount = Math.floor(Math.random() * 500) + 100;
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 14)); // Random date in the last 14 days
        
        // Generate recipient details based on transaction type
        let recipientDetails;
        
        if (type === 'Bank Transfer') {
          recipientDetails = {
            name: 'John Doe',
            accountNumber: '123456789',
            routingNumber: '987654321'
          };
        } else if (type === 'Wire Transfer') {
          recipientDetails = {
            name: 'Jane Smith',
            accountNumber: '987654321',
            swiftCode: 'ABABUS33',
            bankName: 'Global Bank',
            bankAddress: '123 Finance St, New York, NY'
          };
        } else {
          recipientDetails = null;
        }
        
        await pool.query(`
          INSERT INTO transactions (id, user_id, type, amount, description, date_time, status, recipient_details)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          uuidv4(), 
          userId, 
          type, 
          amount, 
          description, 
          date.toISOString(), 
          'Completed', 
          recipientDetails ? JSON.stringify(recipientDetails) : null
        ]);
      }
      
      console.log('Test user created with ID:', userId);
    } else {
      console.log('Test user already exists');
    }

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Initialize the database when the server starts
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

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password.' });
    }
    
    console.log('Login attempt for username:', username);
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1 AND status = $2', [username, 'Active']);
    
    if (userResult.rows.length === 0) {
      console.log('User not found or inactive:', username);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    
    const user = userResult.rows[0];
    console.log('User found:', user.username);
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    
    console.log('Password valid for user:', username);
    
    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key',
      { expiresIn: '1h' }
    );
    
    // Log admin login action if admin
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

// User routes
// Get all users (admin only)
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

// Get user by ID
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can only access their own data, admins can access any
    if (req.user.id !== id && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = result.rows[0];
    
    // Remove sensitive information
    delete user.password;
    delete user.pin;
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error while retrieving user.' });
  }
});

// Create user (admin only)
app.post('/api/users', async (req, res) => {
  try {
    console.log('Create user request received:', req.body);
    
    // Allow creating users directly from the signup form without auth
    const isSignupRequest = req.body.isSignup === true || req.headers['x-signup'] === 'true';
    const isAdminRequest = req.headers.authorization && jwt.verify(
      req.headers.authorization.split(' ')[1], 
      process.env.JWT_SECRET || 'nivalus_bank_secure_jwt_secret_key'
    ).username === 'admin';
    
    if (!isSignupRequest && !isAdminRequest) {
      return res.status(403).json({ message: 'Access denied. Admin only or signup required.' });
    }
    
    const { full_name, username, email, password, pin, phone } = req.body;
    
    // Validate input
    if (!full_name || !username || !email || !password || !pin) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }
    
    // Check if username or email already exists
    const checkResult = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }
    
    // Hash password and PIN
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10);
    const userId = uuidv4();
    
    // Insert user
    await pool.query(`
      INSERT INTO users (id, full_name, username, email, password, pin, phone, balance, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [userId, full_name, username, email, hashedPassword, hashedPin, phone || '', 0, 'Active']);
    
    console.log('User created successfully:', { username, id: userId });
    
    // Log action if it's an admin request
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

// Delete user (admin only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    
    // Delete user's transactions first (FK constraint)
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [id]);
    
    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    // Log action
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

// Update user status (active/inactive) (admin only)
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
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    
    // Update status
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    
    // Log action
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

// Update user balance (admin only)
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
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    const newBalance = parseFloat(balance);
    
    // Update balance
    await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, id]);
    
    // Log action
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

// Upload user avatar
app.post('/api/users/:userId/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only upload their own avatar, admins can upload for anyone
    if (req.user.id !== userId && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    // Create relative path for the avatar
    const avatarUrl = `/assets/avatars/${req.file.filename}`;
    
    // Update the user record with the avatar URL
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

// Delete user avatar
app.delete('/api/users/:userId/avatar', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only delete their own avatar, admins can delete for anyone
    if (req.user.id !== userId && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    // Get current avatar URL
    const userResult = await pool.query('SELECT avatar FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const { avatar } = userResult.rows[0];
    
    // Remove avatar file if exists
    if (avatar) {
      const avatarPath = path.join(__dirname, '..', avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }
    
    // Clear avatar field in database
    await pool.query('UPDATE users SET avatar = NULL WHERE id = $1', [userId]);
    
    res.json({ message: 'Avatar removed successfully.' });
  } catch (error) {
    console.error('Avatar delete error:', error);
    res.status(500).json({ message: 'Server error while deleting avatar.' });
  }
});

// Verify user PIN
app.post('/api/users/verify-pin', authenticateToken, async (req, res) => {
  try {
    const { userId, pin } = req.body;
    
    if (!userId || !pin) {
      return res.status(400).json({ message: 'User ID and PIN are required.' });
    }
    
    // Users can only verify their own PIN
    if (req.user.id !== userId && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    // Get user's hashed PIN
    const userResult = await pool.query('SELECT pin FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const hashedPin = userResult.rows[0].pin;
    
    // Verify PIN
    const valid = await bcrypt.compare(pin, hashedPin);
    
    res.json({ valid });
  } catch (error) {
    console.error('PIN verification error:', error);
    res.status(500).json({ message: 'Server error while verifying PIN.' });
  }
});

// Transaction routes
// Get all transactions (admin only)
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

// Get user transactions
app.get('/api/transactions/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // Users can only see their own transactions, admins can see any
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

// Create transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { user_id, type, amount, description, date_time, recipient_details } = req.body;
    
    // Validate input
    if (!user_id || !type || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Invalid transaction data.' });
    }
    
    // Users can only create transactions for themselves, admins can create for any user
    if (req.user.id !== user_id && req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' });
    }
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const user = userResult.rows[0];
    const transactionAmount = parseFloat(amount);
    
    // Get transaction limits from settings
    const settingsResult = await pool.query('SELECT * FROM settings WHERE key = $1 OR key = $2', 
      ['max_transaction_limit', 'minimum_balance']);
    
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = parseFloat(row.value);
    });
    
    // Check transaction limits
    if (transactionAmount > settings.max_transaction_limit) {
      return res.status(400).json({ 
        message: `Transaction amount exceeds maximum limit of $${settings.max_transaction_limit}.` 
      });
    }
    
    // For withdrawals and transfers, check balance
    if ((type === 'Withdrawal' || type === 'Bank Transfer' || type === 'Wire Transfer' || type === 'P2P') && 
        user.balance < transactionAmount) {
      return res.status(400).json({ message: 'Insufficient balance for this transaction.' });
    }
    
    // Check minimum balance
    if ((type === 'Withdrawal' || type === 'Bank Transfer' || type === 'Wire Transfer' || type === 'P2P') && 
        (user.balance - transactionAmount) < settings.minimum_balance) {
      return res.status(400).json({ 
        message: `This transaction would put the account below the minimum balance of $${settings.minimum_balance}.` 
      });
    }
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create transaction record
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
      
      // Update user balance
      let newBalance;
      if (type === 'Deposit') {
        newBalance = parseFloat(user.balance) + transactionAmount;
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user_id]);
      } else if (type === 'Withdrawal' || type === 'Bank Transfer' || type === 'Wire Transfer' || type === 'P2P') {
        newBalance = parseFloat(user.balance) - transactionAmount;
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, user_id]);
      }
      
      // Log action if admin
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

// Delete transaction (admin only)
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { id } = req.params;
    
    // Check if transaction exists
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
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Revert balance change
      let newBalance;
      if (transaction.type === 'Deposit') {
        // If it was a deposit, subtract the amount
        newBalance = parseFloat(transaction.balance) - parseFloat(transaction.amount);
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, transaction.user_id]);
      } else if (transaction.type === 'Withdrawal' || transaction.type === 'Bank Transfer' || transaction.type === 'Wire Transfer' || transaction.type === 'P2P') {
        // If it was a withdrawal/transfer, add the amount back
        newBalance = parseFloat(transaction.balance) + parseFloat(transaction.amount);
        await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, transaction.user_id]);
      }
      
      // Delete transaction
      await client.query('DELETE FROM transactions WHERE id = $1', [id]);
      
      // Log action
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

// Settings routes
// Get all settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    
    // Convert to object format
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

// Update settings (admin only)
app.patch('/api/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.username !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const { transaction_fee, minimum_balance, max_transaction_limit, daily_transaction_limit } = req.body;
    
    // Validate inputs
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
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        await client.query(`
          UPDATE settings SET value = $1 WHERE key = $2
        `, [value.toFixed(2), key]);
      }
      
      // Log action
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

// Serve the static files for avatars
app.use('/assets/avatars', express.static(path.join(__dirname, '../src/assets/avatars')));

// Serve static files from the Vite build output
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route to serve index.html for SPA routing
app.get('/*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Start server
app.listen(5001, () => {
  console.log('Server running on port 5001');
});