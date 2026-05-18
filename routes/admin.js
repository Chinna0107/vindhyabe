const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authAdmin } = require('../middleware/auth');

// POST /api/admin/login — email + password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/dashboard — stats overview
router.get('/dashboard', authAdmin, async (req, res) => {
  try {
    const [totalOrders, uniqueCustomers, totalProducts, revenue, recentOrders, statusCounts] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query('SELECT COUNT(DISTINCT mobile) FROM orders'),
      pool.query('SELECT COUNT(*) FROM products'),
      pool.query("SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status != 'cancelled'"),
      pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5'),
      pool.query('SELECT status, COUNT(*) FROM orders GROUP BY status')
    ]);

    const counts = { pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    statusCounts.rows.forEach(r => {
      if (counts[r.status] !== undefined) {
        counts[r.status] = parseInt(r.count);
      }
    });

    res.json({
      stats: {
        totalOrders: parseInt(totalOrders.rows[0].count),
        totalCustomers: parseInt(uniqueCustomers.rows[0].count),
        totalProducts: parseInt(totalProducts.rows[0].count),
        revenue: parseFloat(revenue.rows[0].revenue),
        pending: counts.pending,
        confirmed: counts.confirmed,
        processing: counts.processing,
        shipped: counts.shipped,
        delivered: counts.delivered,
        cancelled: counts.cancelled
      },
      recentOrders: recentOrders.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/customers — fetch all registered customers with stats
router.get('/customers', authAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.email, c.mobile, c.created_at,
             COALESCE(COUNT(o.id), 0) AS total_orders,
             COALESCE(SUM(o.total), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o ON c.email = o.email OR c.mobile = o.mobile
      GROUP BY c.id, c.name, c.email, c.mobile, c.created_at
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
