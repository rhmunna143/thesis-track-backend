const express = require('express');
const { 
    createProposal, 
    getProposals, 
    updateProposalStatus, 
    assignSupervisor 
} = require('../controllers/proposalController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorizeAdmin, authorizeTeacher } = require('../middlewares/roleMiddleware');
const upload = require('../utils/fileUpload');

const router = express.Router();

router.post('/', authenticate, upload.single('document'), createProposal);
router.get('/', authenticate, getProposals);
router.patch('/:id/status', authenticate, authorizeTeacher, updateProposalStatus);
router.patch('/:id/assign', authenticate, authorizeAdmin, assignSupervisor);

module.exports = router;