const router = require('express').Router();
const pool = require('../db');
const { authAdmin } = require('../middleware/auth');

// GET /api/coupons — admin: list all
router.get('/', authAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM coupons ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coupons — admin: create
router.post('/', authAdmin, async (req, res) => {
  const { code, discount_percent, description, is_active, min_order_value, max_uses, expiry_date } = req.body;
  if (!code || !discount_percent) return res.status(400).json({ error: 'code and discount_percent are required' });
  try {
    const result = await pool.query(
      `INSERT INTO coupons (code, discount_percent, description, is_active, min_order_value, max_uses, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        code.toUpperCase().trim(),
        parseFloat(discount_percent),
        description || '',
        is_active !== false,
        min_order_value ? parseFloat(min_order_value) : null,
        max_uses ? parseInt(max_uses) : null,
        expiry_date || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Coupon code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/coupons/:id — admin: update
router.put('/:id', authAdmin, async (req, res) => {
  const { code, discount_percent, description, is_active, min_order_value, max_uses, expiry_date } = req.body;
  try {
    const result = await pool.query(
      `UPDATE coupons SET code=$1, discount_percent=$2, description=$3, is_active=$4,
       min_order_value=$5, max_uses=$6, expiry_date=$7 WHERE id=$8 RETURNING *`,
      [
        code.toUpperCase().trim(),
        parseFloat(discount_percent),
        description || '',
        is_active !== false,
        min_order_value ? parseFloat(min_order_value) : null,
        max_uses ? parseInt(max_uses) : null,
        expiry_date || null,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Coupon code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/coupons/:id — admin: delete
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coupons/validate — public: validate coupon
router.post('/validate', async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ valid: false, message: 'Code is required' });
  try {
    const result = await pool.query(
      'SELECT * FROM coupons WHERE code = $1 AND is_active = true',
      [code.toUpperCase().trim()]
    );
    if (result.rows.length === 0)
      return res.json({ valid: false, message: 'Invalid or expired coupon code' });

    const c = result.rows[0];

    // Check expiry
    if (c.expiry_date && new Date(c.expiry_date) < new Date())
      return res.json({ valid: false, message: 'This coupon has expired' });

    // Check usage limit
    if (c.max_uses && (c.used_count || 0) >= c.max_uses)
      return res.json({ valid: false, message: 'This coupon has reached its usage limit' });

    // Check min order value
    if (c.min_order_value && subtotal !== undefined && parseFloat(subtotal) < parseFloat(c.min_order_value))
      return res.json({
        valid: false,
        message: `Minimum order value of ₹${c.min_order_value} required for this coupon`,
      });

    res.json({
      valid: true,
      discount_percent: parseFloat(c.discount_percent),
      description: c.description,
      min_order_value: c.min_order_value ? parseFloat(c.min_order_value) : 0,
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: err.message });
  }
});

module.exports = router;
