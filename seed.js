const pool = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const newProducts = [
  // Pickles
  {
    slug: 'mango-avakaya',
    name: 'Mango Avakaya',
    category: 'pickles',
    subcategory: 'veg',
    tag: 'Bestseller',
    emoji: '🥭',
    short_desc: 'Traditional Andhra raw mango pickle with mustard & red chilli',
    spice: 5,
    prices: [
      { weight: '250g', price: 180, originalPrice: 220 },
      { weight: '500g', price: 320, originalPrice: 380 },
      { weight: '1kg', price: 580, originalPrice: 680 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778404515/WhatsApp_Image_2026-05-10_at_14.44.31_4_eqhu5p.jpg']
  },
  {
    slug: 'gongura-pachadi',
    name: 'Gongura Pachadi',
    category: 'pickles',
    subcategory: 'veg',
    tag: 'Popular',
    emoji: '🌿',
    short_desc: "Tangy sorrel leaves pickle — Andhra's pride",
    spice: 4,
    prices: [
      { weight: '250g', price: 160, originalPrice: 200 },
      { weight: '500g', price: 290, originalPrice: 360 },
      { weight: '1kg', price: 540, originalPrice: 660 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778405461/WhatsApp_Image_2026-05-10_at_14.56.05_sncsrn.jpg']
  },
  {
    slug: 'garlic-pickle',
    name: 'Garlic Pickle',
    category: 'pickles',
    subcategory: 'veg',
    tag: 'Spicy',
    emoji: '🧄',
    short_desc: 'Bold garlic pickle with fiery Guntur chillies',
    spice: 5,
    prices: [
      { weight: '250g', price: 170, originalPrice: 210 },
      { weight: '500g', price: 310, originalPrice: 390 },
      { weight: '1kg', price: 580, originalPrice: 710 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778405462/WhatsApp_Image_2026-05-10_at_14.56.05_1_qyx6ms.jpg']
  },
  {
    slug: 'tomato-pickle',
    name: 'Tomato Pickle',
    category: 'pickles',
    subcategory: 'veg',
    tag: 'New',
    emoji: '🍅',
    short_desc: 'Sun-dried tomato pickle with aromatic spices',
    spice: 3,
    prices: [
      { weight: '250g', price: 140, originalPrice: 170 },
      { weight: '500g', price: 260, originalPrice: 320 },
      { weight: '1kg', price: 480, originalPrice: 600 }
    ],
    images: ['https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600&auto=format&fit=crop&q=80']
  },
  {
    slug: 'chicken-pickle',
    name: 'Chicken Pickle',
    category: 'pickles',
    subcategory: 'non veg',
    tag: 'Bestseller',
    emoji: '🍗',
    short_desc: 'Tender chicken pieces marinated in Andhra spice blend',
    spice: 5,
    prices: [
      { weight: '250g', price: 320, originalPrice: 380 },
      { weight: '500g', price: 580, originalPrice: 700 },
      { weight: '1kg', price: 1050, originalPrice: 1280 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778404515/WhatsApp_Image_2026-05-10_at_14.44.31_u6ztzv.jpg']
  },
  {
    slug: 'mutton-pickle',
    name: 'Mutton Pickle',
    category: 'pickles',
    subcategory: 'non veg',
    tag: 'Premium',
    emoji: '🥩',
    short_desc: 'Slow-cooked mutton pickle with rich masala',
    spice: 4,
    prices: [
      { weight: '250g', price: 380, originalPrice: 450 },
      { weight: '500g', price: 690, originalPrice: 850 },
      { weight: '1kg', price: 1250, originalPrice: 1550 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778404516/WhatsApp_Image_2026-05-10_at_14.44.31_1_uvlhut.jpg']
  },

  // Podi's
  {
    slug: 'kandi-podi',
    name: 'Kandi Podi',
    category: "podi's",
    subcategory: null,
    tag: 'Bestseller',
    emoji: '🌶️',
    short_desc: 'Roasted lentil powder — perfect with rice & ghee',
    spice: 3,
    prices: [
      { weight: '200g', price: 120, originalPrice: 150 },
      { weight: '400g', price: 220, originalPrice: 280 },
      { weight: '800g', price: 410, originalPrice: 520 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778404515/WhatsApp_Image_2026-05-10_at_14.44.31_2_zsviyl.jpg']
  },
  {
    slug: 'palli-podi',
    name: 'Palli Podi',
    category: "podi's",
    subcategory: null,
    tag: 'Classic',
    emoji: '🥜',
    short_desc: 'Roasted groundnut powder with curry leaves',
    spice: 3,
    prices: [
      { weight: '200g', price: 100, originalPrice: 130 },
      { weight: '400g', price: 185, originalPrice: 240 },
      { weight: '800g', price: 345, originalPrice: 450 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778405462/WhatsApp_Image_2026-05-10_at_14.56.06_dbvxz4.jpg']
  },
  {
    slug: 'karivepaku-podi',
    name: 'Karivepaku Podi',
    category: "podi's",
    subcategory: null,
    tag: 'Aromatic',
    emoji: '🌿',
    short_desc: 'Curry leaf powder — fragrant & flavorful',
    spice: 2,
    prices: [
      { weight: '200g', price: 105, originalPrice: 135 },
      { weight: '400g', price: 195, originalPrice: 250 },
      { weight: '800g', price: 360, originalPrice: 470 }
    ],
    images: ['https://res.cloudinary.com/dgyykbmt6/image/upload/v1778405462/WhatsApp_Image_2026-05-10_at_14.56.06_1_viotd3.jpg']
  },

  // Snacks - Sweet Items
  {
    slug: 'special-sunnundalu',
    name: 'Special Sunnundalu',
    category: 'snacks',
    subcategory: 'sweet items',
    tag: 'Traditional',
    emoji: '🫓',
    short_desc: 'Traditional roasted urad dal sweet balls made with pure ghee and jaggery',
    spice: 0,
    prices: [
      { weight: '250g', price: 150, originalPrice: 190 },
      { weight: '500g', price: 280, originalPrice: 350 },
      { weight: '1kg', price: 540, originalPrice: 650 }
    ],
    images: ['https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=600&auto=format&fit=crop&q=80']
  },
  {
    slug: 'bellam-ariselu',
    name: 'Bellam Ariselu',
    category: 'snacks',
    subcategory: 'sweet items',
    tag: 'Bestseller',
    emoji: '🍪',
    short_desc: 'Traditional festive sweet made of rice flour, jaggery and pure ghee',
    spice: 0,
    prices: [
      { weight: '250g', price: 160, originalPrice: 200 },
      { weight: '500g', price: 300, originalPrice: 380 },
      { weight: '1kg', price: 580, originalPrice: 700 }
    ],
    images: ['https://images.unsplash.com/photo-1605697040924-87edd5876658?w=600&auto=format&fit=crop&q=80']
  },

  // Snacks - Hot Items
  {
    slug: 'andhra-janthikalu',
    name: 'Andhra Janthikalu',
    category: 'snacks',
    subcategory: 'hot items',
    tag: 'Crunchy',
    emoji: '🥨',
    short_desc: 'Crispy fried snack made from rice flour and chickpea flour with sesame seeds',
    spice: 3,
    prices: [
      { weight: '250g', price: 110, originalPrice: 140 },
      { weight: '500g', price: 200, originalPrice: 260 },
      { weight: '1kg', price: 380, originalPrice: 480 }
    ],
    images: ['https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&auto=format&fit=crop&q=80']
  },
  {
    slug: 'spicy-chegodi',
    name: 'Spicy Chegodi',
    category: 'snacks',
    subcategory: 'hot items',
    tag: 'Popular',
    emoji: '⭕',
    short_desc: 'Crunchy golden ring-shaped snacks loaded with red chilli powder and moong dal',
    spice: 4,
    prices: [
      { weight: '250g', price: 120, originalPrice: 150 },
      { weight: '500g', price: 220, originalPrice: 280 },
      { weight: '1kg', price: 420, originalPrice: 520 }
    ],
    images: ['https://images.unsplash.com/photo-1627308595229-7830f5c90683?w=600&auto=format&fit=crop&q=80']
  }
];

async function seed() {
  // Create admin
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  await pool.query(
    'INSERT INTO admins (email, password) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
    [process.env.ADMIN_EMAIL || 'admin@vindhya.com', hash]
  );

  // Create CEO admin
  const ceoHash = await bcrypt.hash('Vindhya@005', 10);
  await pool.query(
    'INSERT INTO admins (email, password) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
    ['ceo@vindhyafoods.com', ceoHash]
  );
  console.log('✅ Admins created / updated');

  // Truncate existing products
  await pool.query('DELETE FROM products');
  console.log('✅ Existing products removed');

  // Seed new products
  for (const p of newProducts) {
    const productResult = await pool.query(
      `INSERT INTO products (slug, name, category, subcategory, tag, emoji, short_desc, spice, prices, images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [p.slug, p.name, p.category, p.subcategory, p.tag, p.emoji, p.short_desc, p.spice, JSON.stringify(p.prices), p.images]
    );
    
    if (productResult.rows.length > 0) {
      const productId = productResult.rows[0].id;
      
      const reviewSamples = [
        {
          name: 'Hemanth Guntur',
          rating: 5,
          comment: `Absolutely loved this! The traditional taste reminds me of my grandmother's cooking. Perfect spice levels.`
        },
        {
          name: 'Niharika K.',
          rating: 4,
          comment: `Extremely fresh and delicious. Very authentic taste. Packaging was also very premium. Highly recommend!`
        }
      ];
      
      for (const rev of reviewSamples) {
        await pool.query(
          `INSERT INTO product_reviews (product_id, customer_name, rating, comment)
           VALUES ($1, $2, $3, $4)`,
          [productId, rev.name, rev.rating, rev.comment]
        );
      }
      
      await pool.query(
        `UPDATE products SET rating = 4.5, reviews = 2 WHERE id = $1`,
        [productId]
      );
    }
  }
  console.log('✅ New Products & Reviews seeded');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
