const pool = require('./db');
require('dotenv').config();

const testItems = [
  { name: 'Mango Avakaya',     selectedWeight: '250g', price: 180, qty: 1 },
  { name: 'Chicken Pickle',    selectedWeight: '500g', price: 580, qty: 2 },
  { name: 'Gongura Pachadi',   selectedWeight: '250g', price: 160, qty: 1 },
  { name: 'Kandi Podi',        selectedWeight: '200g', price: 120, qty: 1 },
  { name: 'Garlic Pickle',     selectedWeight: '500g', price: 310, qty: 1 },
  { name: 'Andhra Janthikalu', selectedWeight: '250g', price: 110, qty: 1 },
];

const subtotal = testItems.reduce((sum, i) => sum + i.price * i.qty, 0);
const discount = 50;
const delivery = 0;
const total    = subtotal - discount + delivery;

async function seedTestOrder() {
  const result = await pool.query(
    `INSERT INTO orders (mobile, email, name, items, subtotal, discount, delivery, total, coupon, address, status, payment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      '9876543210',
      'testcustomer@example.com',
      'Test Customer',
      JSON.stringify(testItems),
      subtotal,
      discount,
      delivery,
      total,
      'TESTOFF50',
      '123, Test Street, Hyderabad, Telangana - 500001',
      'confirmed',
      'pay_test_' + Date.now(),
    ]
  );
  console.log(`✅ Test order created | ID: ${result.rows[0].id}`);
  console.log(`   Items: ${testItems.length} | Subtotal: ₹${subtotal} | Discount: ₹${discount} | Total: ₹${total}`);
  process.exit(0);
}

seedTestOrder().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
