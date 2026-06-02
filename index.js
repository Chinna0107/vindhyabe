const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Auto-migrate: add missing columns if not exists
pool.query(`
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS name VARCHAR(100);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(100);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_link TEXT;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100);

  ALTER TABLE customers ADD COLUMN IF NOT EXISTS password VARCHAR(255);
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp VARCHAR(6);
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP;

  ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);
  ALTER TABLE products ADD COLUMN IF NOT EXISTS coupon_applicable BOOLEAN DEFAULT true;

  CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percent NUMERIC NOT NULL,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    min_order_value NUMERIC DEFAULT NULL,
    max_uses INTEGER DEFAULT NULL,
    used_count INTEGER DEFAULT 0,
    expiry_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_value NUMERIC DEFAULT NULL;
  ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT NULL;
  ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0;
  ALTER TABLE coupons ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL;

  CREATE TABLE IF NOT EXISTS otps (
    email VARCHAR(150) PRIMARY KEY,
    otp VARCHAR(6) NOT NULL,
    otp_expiry TIMESTAMP NOT NULL
  );
`)
  .then(() => console.log('✅ Database auto-migrations completed'))
  .catch(err => console.error('Migration error:', err.message));

// Routes
app.use('/api/customer', require('./routes/customer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/coupons', require('./routes/coupons'));

app.get('/', (req, res) => res.json({ message: '🫙 VINDHYA FOODS &  PICKLES API is running' }));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
