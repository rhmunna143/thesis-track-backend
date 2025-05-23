const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendEmail } = require('../services/emailService');
const { validationResult } = require('express-validator');

// Create a new proposal
exports.createProposal = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, abstract, studentId, supervisorId } = req.body;
    const documentUrl = req.file.path;

    try {
        const proposal = await prisma.proposal.create({
            data: {
                title,
                abstract,
                studentId,
                supervisorId,
                documentUrl,
                status: 'PENDING',
            },
        });

        // Send email notification to supervisor
        await sendEmail(supervisorId, 'New Thesis Proposal Submitted', `A new proposal titled "${title}" has been submitted.`);

        res.status(201).json(proposal);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while creating the proposal.' });
    }
};

// Get proposals based on user role
exports.getProposals = async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        let proposals;
        if (userRole === 'STUDENT') {
            proposals = await prisma.proposal.findMany({
                where: { studentId: userId },
            });
        } else if (userRole === 'TEACHER') {
            proposals = await prisma.proposal.findMany({
                where: { supervisorId: userId },
            });
        } else {
            proposals = await prisma.proposal.findMany();
        }

        res.status(200).json(proposals);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while retrieving proposals.' });
    }
};

// Update proposal status
exports.updateProposalStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const proposal = await prisma.proposal.update({
            where: { id: Number(id) },
            data: { status },
        });

        res.status(200).json(proposal);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while updating the proposal status.' });
    }
};