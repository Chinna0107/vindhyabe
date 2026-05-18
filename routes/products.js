const router = require('express').Router();
const pool = require('../db');
const { authAdmin } = require('../middleware/auth');

// GET /api/products
router.get('/', async (req, res) => {
  const { category } = req.query;
  try {
    const query = category
      ? 'SELECT * FROM products WHERE category = $1 ORDER BY id'
      : 'SELECT * FROM products ORDER BY id';
    const result = await pool.query(query, category ? [category] : []);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — admin: add product
router.post('/', authAdmin, async (req, res) => {
  const { slug, name, category, tag, emoji, short_desc, full_desc, spice, benefits, ingredients, prices, images, rating, reviews } = req.body;
  try {
    const reviewsCount = Array.isArray(reviews) ? reviews.length : (parseInt(reviews) || 0);
    const ratingVal = parseFloat(rating) || 0;
    const result = await pool.query(
      `INSERT INTO products (slug, name, category, tag, emoji, short_desc, full_desc, spice, benefits, ingredients, prices, images, rating, reviews)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [slug, name, category, tag, emoji, short_desc, full_desc, spice, benefits, ingredients, JSON.stringify(prices), images, ratingVal, reviewsCount]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id — admin: edit product
router.put('/:id', authAdmin, async (req, res) => {
  const { name, category, tag, emoji, short_desc, full_desc, spice, benefits, ingredients, prices, images, in_stock, rating, reviews } = req.body;
  try {
    const reviewsCount = Array.isArray(reviews) ? reviews.length : (parseInt(reviews) || 0);
    const ratingVal = parseFloat(rating) || 0;
    const result = await pool.query(
      `UPDATE products SET name=$1, category=$2, tag=$3, emoji=$4, short_desc=$5, full_desc=$6,
       spice=$7, benefits=$8, ingredients=$9, prices=$10, images=$11, in_stock=$12, rating=$13, reviews=$14
       WHERE id=$15 RETURNING *`,
      [name, category, tag, emoji, short_desc, full_desc, spice, benefits, ingredients, JSON.stringify(prices), images, in_stock, ratingVal, reviewsCount, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id — admin: delete product
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id/reviews — get product reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM product_reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/reviews — add product review (public/admin)
router.post('/:id/reviews', async (req, res) => {
  const { customer_name, rating, comment } = req.body;
  try {
    const reviewResult = await pool.query(
      `INSERT INTO product_reviews (product_id, customer_name, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, customer_name, rating, comment]
    );
    
    const statsResult = await pool.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count 
       FROM product_reviews WHERE product_id = $1`,
      [req.params.id]
    );
    
    const avgRating = parseFloat(statsResult.rows[0].avg_rating || rating).toFixed(1);
    const reviewCount = parseInt(statsResult.rows[0].review_count || 1);
    
    await pool.query(
      `UPDATE products SET rating = $1, reviews = $2 WHERE id = $3`,
      [avgRating, reviewCount, req.params.id]
    );
    
    res.status(201).json(reviewResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id/reviews — sync/replace all reviews for a product (admin)
const syncReviewsHandler = async (req, res) => {
  const { reviews } = req.body;
  const productId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Delete all existing reviews for this product
    await client.query('DELETE FROM product_reviews WHERE product_id = $1', [productId]);
    
    // 2. Insert new reviews
    let totalStars = 0;
    let count = 0;
    if (Array.isArray(reviews) && reviews.length > 0) {
      for (const rev of reviews) {
        // support both name/customer_name and created_at/date
        const customer_name = rev.customer_name || rev.name;
        const comment = rev.comment;
        if (!customer_name || !comment) continue;
        const rating = parseInt(rev.rating) || 5;
        totalStars += rating;
        count++;
        const date = rev.created_at || rev.date || new Date().toISOString();
        await client.query(
          `INSERT INTO product_reviews (product_id, customer_name, rating, comment, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, customer_name, rating, comment, date]
        );
      }
    }
    
    // 3. Update products aggregated stats
    const avgRating = count > 0 ? parseFloat(totalStars / count).toFixed(1) : '4.5';
    const reviewCount = count;
    await client.query(
      `UPDATE products SET rating = $1, reviews = $2 WHERE id = $3`,
      [avgRating, reviewCount, productId]
    );
    
    await client.query('COMMIT');
    res.status(200).json({ success: true, reviews_count: reviewCount, rating: avgRating });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

router.put('/:id/reviews', authAdmin, syncReviewsHandler);
router.patch('/:id/reviews', authAdmin, syncReviewsHandler);

module.exports = router;

