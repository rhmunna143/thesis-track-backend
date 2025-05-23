const express = require('express');
const { registerUser, loginUser, getCurrentUser, listUsers } = require('../controllers/userController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorizeAdmin } = require('../middlewares/roleMiddleware');

const router = express.Router();

router.post('/register', authenticate, authorizeAdmin, registerUser);
router.post('/login', loginUser);
router.get('/me', authenticate, getCurrentUser);
router.get('/users', authenticate, authorizeAdmin, listUsers);

module.exports = router;