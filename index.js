require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cors = require('cors');

// Initialize Express app
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Configure middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({ 
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Role-based authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access forbidden: insufficient permissions' });
    }
    next();
  };
};

// Helper function to send emails
const sendEmail = async (to, subject, text, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    // Continue execution even if email fails
  }
};

// AUTH ROUTES
// Keep admin registration endpoint with restricted role assignment
app.post('/auth/register', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { name, email, password, role = 'STUDENT' } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    
    // Only allow STUDENT or TEACHER roles to be created by admins
    if (!['STUDENT', 'TEACHER'].includes(role)) {
      return res.status(400).json({ message: 'Admins can only create STUDENT or TEACHER accounts' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    res.status(201).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/me', authenticate, async (req, res) => {
  res.json(req.user);
});

// Create a public registration endpoint (no authentication required)
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Special case for admin email
    const role = email === 'rhmunna19@gmail.com' ? 'ADMIN' : 'STUDENT';
    
    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    res.status(201).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PROPOSAL ROUTES
app.post('/proposals', authenticate, authorize(['STUDENT']), upload.single('document'), async (req, res) => {
  try {
    // Check if there is an active session
    const activeSession = await prisma.session.findFirst({
      where: { isActive: true }
    });
    
    if (!activeSession) {
      return res.status(400).json({ message: 'No active submission session' });
    }
    
    const { title, abstract, supervisorId } = req.body;
    
    // Validation
    if (!title || !abstract || !supervisorId || !req.file) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if supervisor exists and is a TEACHER
    const supervisor = await prisma.user.findFirst({
      where: { id: Number(supervisorId), role: 'TEACHER' }
    });
    
    if (!supervisor) {
      return res.status(400).json({ message: 'Invalid supervisor' });
    }
    
    // Create proposal
    const proposal = await prisma.proposal.create({
      data: {
        title,
        abstract,
        status: 'PENDING',
        documentUrl: req.file.path,
        student: { connect: { id: req.user.id } },
        supervisor: { connect: { id: Number(supervisorId) } }
      },
      include: {
        student: {
          select: { name: true, email: true }
        },
        supervisor: {
          select: { name: true, email: true }
        }
      }
    });
    
    // Send notification email to supervisor
    await sendEmail(
      proposal.supervisor.email,
      'New Thesis Proposal Submitted',
      `Dear ${proposal.supervisor.name},\n\nA new thesis proposal "${title}" has been submitted by ${proposal.student.name} and requires your review.`,
      `<p>Dear ${proposal.supervisor.name},</p>
       <p>A new thesis proposal <strong>"${title}"</strong> has been submitted by ${proposal.student.name} and requires your review.</p>
       <p>Please log in to the ThesisTrack system to review this proposal.</p>`
    );
    
    res.status(201).json(proposal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/proposals', authenticate, async (req, res) => {
  try {
    let proposals = [];
    
    if (req.user.role === 'ADMIN') {
      // Admin sees all proposals
      proposals = await prisma.proposal.findMany({
        include: {
          student: {
            select: { id: true, name: true, email: true }
          },
          supervisor: {
            select: { id: true, name: true, email: true }
          },
          comments: {
            include: {
              commenter: {
                select: { id: true, name: true, role: true }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } else if (req.user.role === 'TEACHER') {
      // Teachers see proposals where they're the supervisor
      proposals = await prisma.proposal.findMany({
        where: {
          supervisorId: req.user.id
        },
        include: {
          student: {
            select: { id: true, name: true, email: true }
          },
          supervisor: {
            select: { id: true, name: true, email: true }
          },
          comments: {
            include: {
              commenter: {
                select: { id: true, name: true, role: true }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } else if (req.user.role === 'STUDENT') {
      // Students see their own proposals
      proposals = await prisma.proposal.findMany({
        where: {
          studentId: req.user.id
        },
        include: {
          student: {
            select: { id: true, name: true, email: true }
          },
          supervisor: {
            select: { id: true, name: true, email: true }
          },
          comments: {
            include: {
              commenter: {
                select: { id: true, name: true, role: true }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }
    
    res.json(proposals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/proposals/:id/status', authenticate, authorize(['TEACHER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'];
    
    // Validation
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Valid status is required' });
    }
    
    // Check if proposal exists and belongs to this supervisor
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: Number(id),
        supervisorId: req.user.id
      },
      include: {
        student: {
          select: { name: true, email: true }
        }
      }
    });
    
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found or access denied' });
    }
    
    // Update proposal status
    const updatedProposal = await prisma.proposal.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        student: {
          select: { name: true, email: true }
        },
        supervisor: {
          select: { name: true, email: true }
        }
      }
    });
    
    // Send notification email to student
    await sendEmail(
      proposal.student.email,
      `Thesis Proposal Status Updated: ${status}`,
      `Dear ${proposal.student.name},\n\nThe status of your thesis proposal has been updated to ${status} by ${req.user.name}.`,
      `<p>Dear ${proposal.student.name},</p>
       <p>The status of your thesis proposal has been updated to <strong>${status}</strong> by ${req.user.name}.</p>
       <p>Please log in to the ThesisTrack system for more details.</p>`
    );
    
    res.json(updatedProposal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/proposals/:id/assign', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { supervisorId } = req.body;
    
    // Validation
    if (!supervisorId) {
      return res.status(400).json({ message: 'Supervisor ID is required' });
    }
    
    // Check if supervisor exists and is a TEACHER
    const supervisor = await prisma.user.findFirst({
      where: { id: Number(supervisorId), role: 'TEACHER' }
    });
    
    if (!supervisor) {
      return res.status(400).json({ message: 'Invalid supervisor' });
    }
    
    // Check if proposal exists
    const proposalExists = await prisma.proposal.findUnique({
      where: { id: Number(id) },
      include: {
        student: {
          select: { name: true, email: true }
        }
      }
    });
    
    if (!proposalExists) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    // Update proposal supervisor
    const updatedProposal = await prisma.proposal.update({
      where: { id: Number(id) },
      data: { supervisorId: Number(supervisorId) },
      include: {
        student: {
          select: { name: true, email: true }
        },
        supervisor: {
          select: { name: true, email: true }
        }
      }
    });
    
    // Send notification emails
    await sendEmail(
      updatedProposal.supervisor.email,
      'Thesis Proposal Assigned to You',
      `Dear ${updatedProposal.supervisor.name},\n\nYou have been assigned as the supervisor for the thesis proposal "${updatedProposal.title}" by ${updatedProposal.student.name}.`,
      `<p>Dear ${updatedProposal.supervisor.name},</p>
       <p>You have been assigned as the supervisor for the thesis proposal <strong>"${updatedProposal.title}"</strong> by ${updatedProposal.student.name}.</p>
       <p>Please log in to the ThesisTrack system to review this proposal.</p>`
    );
    
    await sendEmail(
      updatedProposal.student.email,
      'New Supervisor Assigned',
      `Dear ${updatedProposal.student.name},\n\n${updatedProposal.supervisor.name} has been assigned as the supervisor for your thesis proposal.`,
      `<p>Dear ${updatedProposal.student.name},</p>
       <p>${updatedProposal.supervisor.name} has been assigned as the supervisor for your thesis proposal.</p>
       <p>Please log in to the ThesisTrack system for more details.</p>`
    );
    
    res.json(updatedProposal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// COMMENT ROUTES
app.post('/comments', authenticate, authorize(['TEACHER', 'ADMIN']), async (req, res) => {
  try {
    const { proposalId, content } = req.body;
    
    // Validation
    if (!proposalId || !content) {
      return res.status(400).json({ message: 'Proposal ID and content are required' });
    }
    
    // Check if proposal exists
    const proposal = await prisma.proposal.findUnique({
      where: { id: Number(proposalId) },
      include: {
        student: {
          select: { id: true, name: true, email: true }
        },
        supervisor: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    
    // Check if the commenter is the supervisor or an admin
    if (req.user.role === 'TEACHER' && proposal.supervisorId !== req.user.id) {
      return res.status(403).json({ message: 'You can only comment on proposals you supervise' });
    }
    
    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        proposal: { connect: { id: Number(proposalId) } },
        commenter: { connect: { id: req.user.id } }
      },
      include: {
        commenter: {
          select: { id: true, name: true, role: true }
        }
      }
    });
    
    // Send notification email to student
    await sendEmail(
      proposal.student.email,
      'New Comment on Your Thesis Proposal',
      `Dear ${proposal.student.name},\n\n${req.user.name} has commented on your thesis proposal "${proposal.title}".`,
      `<p>Dear ${proposal.student.name},</p>
       <p>${req.user.name} has commented on your thesis proposal <strong>"${proposal.title}"</strong>.</p>
       <p>Comment: "${content}"</p>
       <p>Please log in to the ThesisTrack system to view the comment and respond if necessary.</p>`
    );
    
    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// SESSION ROUTES
app.post('/sessions', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { name, isActive } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Session name is required' });
    }
    
    // If new session is active, deactivate all other sessions
    if (isActive) {
      await prisma.session.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }
    
    // Create session
    const session = await prisma.session.create({
      data: {
        name,
        isActive: isActive || false
      }
    });
    
    res.status(201).json(session);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/sessions/active', async (req, res) => {
  try {
    const activeSession = await prisma.session.findFirst({
      where: { isActive: true }
    });
    
    if (!activeSession) {
      return res.status(404).json({ message: 'No active session found' });
    }
    
    res.json(activeSession);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change the current register endpoint to be a role management endpoint for admins
app.patch('/users/:id/role', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Validation
    if (!role || !['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Valid role is required' });
    }
    
    // Check if user exists
    const userToUpdate = await prisma.user.findUnique({ 
      where: { id: Number(id) } 
    });
    
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user role
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a route for admins to get all users
app.get('/users', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true, 
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ message: 'File upload error' });
  }
  
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});