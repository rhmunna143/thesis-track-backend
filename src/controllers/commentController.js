const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create a comment on a proposal
const createComment = async (req, res) => {
    const { content, proposalId } = req.body;
    const commenterId = req.user.id; // Assuming user ID is stored in req.user

    try {
        const comment = await prisma.comment.create({
            data: {
                content,
                proposalId,
                commenterId,
            },
        });
        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create comment' });
    }
};

// Export the controller functions
module.exports = {
    createComment,
};