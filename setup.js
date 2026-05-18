const pool = require('./db');

async function setupDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(150) UNIQUE NOT NULL,
      mobile VARCHAR(15) UNIQUE NOT NULL,
      password VARCHAR(255),
      is_verified BOOLEAN DEFAULT FALSE,
      otp VARCHAR(6),
      otp_expiry TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(50),
      subcategory VARCHAR(50),
      tag VARCHAR(50),
      emoji VARCHAR(10),
      short_desc TEXT,
      full_desc TEXT,
      spice INT DEFAULT 1,
      benefits TEXT[],
      ingredients TEXT[],
      prices JSONB,
      images TEXT[],
      rating NUMERIC(3,1) DEFAULT 0,
      reviews INT DEFAULT 0,
      in_stock BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      mobile VARCHAR(15) NOT NULL,
      email VARCHAR(150) NOT NULL,
      name VARCHAR(100),
      items JSONB NOT NULL,
      subtotal NUMERIC(10,2),
      discount NUMERIC(10,2) DEFAULT 0,
      delivery NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2),
      coupon VARCHAR(30),
      status VARCHAR(30) DEFAULT 'pending',
      address TEXT,
      tracking_id VARCHAR(100),
      tracking_link TEXT,
      payment_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id SERIAL PRIMARY KEY,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      customer_name VARCHAR(100) NOT NULL,
      rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Tables created');
  process.exit(0);
}

setupDB().catch(err => {
  console.error('❌ Setup error:', err.message);
  process.exit(1);
});
