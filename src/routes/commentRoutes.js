const express = require('express');
const { createComment } = require('../controllers/commentController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authenticate, createComment);

module.exports = router;