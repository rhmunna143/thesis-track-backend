const express = require('express');
const { register, login, getCurrentUser, listUsers } = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { isAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/register',  register);
router.post('/login', login);
router.get('/me', authenticate, getCurrentUser);
router.get('/users', authenticate, isAdmin, listUsers);

module.exports = router;