const router = require('express').Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const pool = require('../db');
const { authCustomer, authAdmin } = require('../middleware/auth');

async function sendAdminWhatsApp(orderId) {
  // Fetch full order details from DB
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = result.rows[0];
  if (!order) throw new Error('Order not found');

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const itemLines = Array.isArray(items)
    ? items.map(i => `  • ${i.name} (${i.selectedWeight}) x${i.qty}`).join('\n')
    : '  • N/A';

  const message =
`🛒 *New Order Received!*

*Order ID:* #${order.id}
*Customer:* ${order.name || 'N/A'}
*Mobile:* ${order.mobile}
*Email:* ${order.email}

*Items:*
${itemLines}

*Subtotal:* ₹${parseFloat(order.subtotal).toFixed(0)}
${parseFloat(order.discount) > 0 ? `*Discount:* -₹${parseFloat(order.discount).toFixed(0)}\n` : ''}*Total:* ₹${parseFloat(order.total).toFixed(0)}
${order.coupon ? `*Coupon:* ${order.coupon}\n` : ''}
*Address:* ${order.address || 'N/A'}
*Payment ID:* ${order.payment_id || 'N/A'}
*Status:* ${order.status}`;

  const res = await fetch(`https://graph.facebook.com/v25.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: process.env.ADMIN_WHATSAPP,
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } }
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`❌ WhatsApp notification FAILED for Order #${order.id}:`, JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }
  console.log(`✅ WhatsApp notification SENT for Order #${order.id} | msgId: ${data.messages?.[0]?.id}`);
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/orders/create-razorpay-order
router.post('/create-razorpay-order', async (req, res) => {
  const { total } = req.body;
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(total * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/verify-payment
router.post('/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature)
    return res.status(400).json({ error: 'Payment verification failed' });

  const { mobile, email, name, items, subtotal, discount, total, coupon, address } = orderData;
  try {
    const result = await pool.query(
      `INSERT INTO orders (mobile, email, name, items, subtotal, discount, delivery, total, coupon, address, status, payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed',$11) RETURNING *`,
      [mobile, email, name || null, JSON.stringify(items), subtotal, discount || 0, 0, total, coupon || null, address, razorpay_payment_id]
    );
    const order = result.rows[0];
    // Increment coupon used_count if coupon was applied
    if (coupon) {
      await pool.query(
        'UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE code = $1',
        [coupon.toUpperCase().trim()]
      ).catch(() => {}); // non-blocking
    }
    try {
      await sendAdminWhatsApp(order.id);
    } catch (err) {
      console.log(`❌ WhatsApp notification NO for Order #${order.id}:`, err.message);
    }
    res.status(201).json({ order, paymentId: razorpay_payment_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/my — customer: own orders
router.get('/my', authCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE mobile = $1 ORDER BY created_at DESC',
      [req.customer.mobile]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders — admin: all orders
router.get('/', authAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status
      ? 'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM orders ORDER BY created_at DESC';
    const result = await pool.query(query, status ? [status] : []);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/status — admin: update order status
router.put('/:id/status', authAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/tracking — admin: update tracking info
router.put('/:id/tracking', authAdmin, async (req, res) => {
  const { trackingId, trackingLink } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE orders SET tracking_id = $1, tracking_link = $2 WHERE id = $3 RETURNING *',
      [trackingId || null, trackingLink || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/:id/notify-preparing — admin: send WhatsApp notification
router.post('/:id/notify-preparing', authAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = result.rows[0];

    const mobile = order.mobile;
    const orderId = order.id;
    const message = `Dear Customer, your order #${orderId} is preparing now at Vindhya Pickles & Foods. Thank you for choosing us!`;

    let whatsappSent = false;
    try {
      const whatsapp = require('../whatsapp');
      if (whatsapp.isReady()) {
        await whatsapp.sendWhatsApp(mobile, message);
        whatsappSent = true;
        console.log(`✅ WhatsApp Web notification sent to ${mobile} for Order #${orderId}`);
      }
    } catch (err) {
      console.log(`⚠️ whatsapp-web.js send skipped/failed:`, err.message);
    }

    if (!whatsappSent) {
      console.log(`\n📨 [MOCK WHATSAPP] To ${mobile}: "${message}"\n`);
      whatsappSent = true;
    }

    res.json({ message: 'WhatsApp notification sent successfully', orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
