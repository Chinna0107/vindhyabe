const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const pool = require('../db');
const { authCustomer } = require('../middleware/auth');

const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER || '';
const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS || '';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // Use STARTTLS
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: `"Vindhya Foods" <${smtpUser || 'no-reply@vindhyafoods.com'}>`,
    to: email,
    subject: 'Vindhya Foods — OTP for Signup',
    text: `Your OTP for signup is ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #c8102e; text-align: center;">Vindhya Foods & Pickles</h2>
        <p>Dear Customer,</p>
        <p>Thank you for choosing Vindhya Foods. Your One-Time Password (OTP) for account signup is:</p>
        <div style="font-size: 24px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; background-color: #fcfcfc; border: 1px dashed #c8102e; letter-spacing: 4px; color: #c8102e;">
          ${otp}
        </div>
        <p>This OTP is valid for 10 minutes. Please do not share this OTP with anyone.</p>
        <br/>
        <p>Best regards,</p>
        <p><strong>Vindhya Foods Team</strong></p>
      </div>
    `,
  };

  if (!smtpUser || !smtpPass) {
    console.log(`\n📨 [MOCK EMAIL] OTP for ${email}: ${otp}\n`);
    return true;
  }

  await transporter.sendMail(mailOptions);
}

// POST /api/customer/login — email + password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const customer = result.rows[0];
    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: customer.id, email: customer.email, mobile: customer.mobile, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, email: customer.email, mobile: customer.mobile, name: customer.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/signup/send-otp
router.post('/signup/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const exists = await pool.query('SELECT * FROM customers WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Customer already exists with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const otp_expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert into otps table
    await pool.query(
      `INSERT INTO otps (email, otp, otp_expiry) 
       VALUES ($1, $2, $3)
       ON CONFLICT (email) 
       DO UPDATE SET otp = $2, otp_expiry = $3`,
      [email.toLowerCase(), otp, otp_expiry]
    );

    await sendOTPEmail(email.toLowerCase(), otp);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/signup/verify-otp
router.post('/signup/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  try {
    const result = await pool.query('SELECT * FROM otps WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'OTP request not found' });
    }

    const record = result.rows[0];
    if (record.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > new Date(record.otp_expiry)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer/signup/complete
router.post('/signup/complete', async (req, res) => {
  const { email, name, mobile, password } = req.body;
  if (!email || !name || !mobile || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const otpCheck = await pool.query('SELECT * FROM otps WHERE email = $1', [email.toLowerCase()]);
    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Email has not been verified or session expired' });
    }

    const existsEmail = await pool.query('SELECT * FROM customers WHERE email = $1', [email.toLowerCase()]);
    if (existsEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const existsMobile = await pool.query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
    if (existsMobile.rows.length > 0) {
      return res.status(400).json({ error: 'Mobile number is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO customers (name, email, mobile, password, is_verified) 
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [name, email.toLowerCase(), mobile, hashedPassword]
    );

    await pool.query('DELETE FROM otps WHERE email = $1', [email.toLowerCase()]);

    const customer = result.rows[0];

    const token = jwt.sign(
      { id: customer.id, email: customer.email, mobile: customer.mobile, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, email: customer.email, mobile: customer.mobile, name: customer.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customer/dashboard — protected
router.get('/dashboard', authCustomer, async (req, res) => {
  try {
    const orders = await pool.query(
      'SELECT * FROM orders WHERE mobile = $1 ORDER BY created_at DESC',
      [req.customer.mobile]
    );
    res.json({ email: req.customer.email, mobile: req.customer.mobile, orders: orders.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customer/profile — get customer profile from orders
router.get('/profile', authCustomer, async (req, res) => {
  try {
    // Get customer info and orders from orders table
    const orders = await pool.query(
      'SELECT * FROM orders WHERE email = $1 ORDER BY created_at DESC',
      [req.customer.email]
    );
    
    if (orders.rows.length === 0) {
      return res.json({
        email: req.customer.email,
        mobile: req.customer.mobile,
        orders: [],
        totalOrders: 0,
        totalSpent: 0,
        firstOrderDate: null,
        lastOrderDate: null,
        favoriteItems: []
      });
    }
    
    // Calculate customer statistics
    const totalOrders = orders.rows.length;
    const totalSpent = orders.rows.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const firstOrderDate = orders.rows[orders.rows.length - 1].created_at;
    const lastOrderDate = orders.rows[0].created_at;
    
    // Get most recent address from latest order
    const latestOrder = orders.rows.find(order => order.address);
    const recentAddress = latestOrder ? latestOrder.address : null;
    
    // Calculate favorite items (most ordered items)
    const itemCounts = {};
    orders.rows.forEach(order => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (Array.isArray(items)) {
        items.forEach(item => {
          const key = `${item.name}-${item.selectedWeight}`;
          itemCounts[key] = (itemCounts[key] || 0) + item.qty;
        });
      }
    });
    
    const favoriteItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([item, count]) => ({ item, count }));
    
    res.json({
      email: req.customer.email,
      mobile: req.customer.mobile,
      orders: orders.rows,
      totalOrders,
      totalSpent,
      firstOrderDate,
      lastOrderDate,
      recentAddress,
      favoriteItems
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customer/profile — update customer profile (not needed since we use orders table)
// This endpoint is kept for future use but currently returns read-only data
router.put('/profile', authCustomer, async (req, res) => {
  // Since customer data comes from orders, we return the current profile
  // In the future, this could update a separate customers table if needed
  try {
    const orders = await pool.query(
      'SELECT * FROM orders WHERE email = $1 ORDER BY created_at DESC',
      [req.customer.email]
    );
    
    const totalOrders = orders.rows.length;
    const totalSpent = orders.rows.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    const firstOrderDate = orders.rows.length > 0 ? orders.rows[orders.rows.length - 1].created_at : null;
    const lastOrderDate = orders.rows.length > 0 ? orders.rows[0].created_at : null;
    const latestOrder = orders.rows.find(order => order.address);
    const recentAddress = latestOrder ? latestOrder.address : null;
    
    res.json({
      email: req.customer.email,
      mobile: req.customer.mobile,
      orders: orders.rows,
      totalOrders,
      totalSpent,
      firstOrderDate,
      lastOrderDate,
      recentAddress,
      message: 'Profile data is read-only and sourced from your orders'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
