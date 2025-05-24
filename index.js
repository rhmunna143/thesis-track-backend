require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const cors = require("cors");
const { Pool } = require('pg');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Configure middleware
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create a simple query method
const query = (text, params) => pool.query(text, params);

// Database initialization function
async function initializeDatabase() {
  try {
    // Create types - REMOVE "IF NOT EXISTS" from CREATE TYPE statements
    await query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
        CREATE TYPE proposal_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role user_role NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create sessions table
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create proposals table
    await query(`
      CREATE TABLE IF NOT EXISTS proposals (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        abstract TEXT NOT NULL,
        status proposal_status NOT NULL DEFAULT 'PENDING',
        document_url VARCHAR(255) NOT NULL,
        student_id INTEGER NOT NULL REFERENCES users(id),
        supervisor_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create comments table
    await query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        proposal_id INTEGER NOT NULL REFERENCES proposals(id),
        commenter_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_proposals_student_id ON proposals(student_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_proposals_supervisor_id ON proposals(supervisor_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_comments_proposal_id ON comments(proposal_id)`);
    
    console.log('Database initialized successfully');
    
    // Create default admin if it doesn't exist
    const adminEmail = 'rhmunna19@gmail.com';
    const adminExists = await query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Admin User', adminEmail, hashedPassword, 'ADMIN']
      );
      console.log('Default admin created');
    }
    
    // Create a default session if none exists
    const sessionExists = await query('SELECT * FROM sessions WHERE is_active = TRUE');
    
    if (sessionExists.rows.length === 0) {
      await query(
        'INSERT INTO sessions (name, is_active) VALUES ($1, $2)',
        ['Default Session', true]
      );
      console.log('Default active session created');
    }
    
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const { rows } = await query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Role-based authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access forbidden: insufficient permissions" });
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
      html,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    // Continue execution even if email fails
  }
};

// index route
app.get("/", (req, res) => {
  res.send("Welcome to the ThesisTrack API running on port " + PORT);
});

// AUTH ROUTES
// Keep admin registration endpoint with restricted role assignment
app.post(
  "/auth/register",
  authenticate,
  authorize(["ADMIN"]),
  async (req, res) => {
    try {
      const { name, email, password, role = "STUDENT" } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res
          .status(400)
          .json({ message: "Name, email and password are required" });
      }

      // Only allow STUDENT or TEACHER roles to be created by admins
      if (!["STUDENT", "TEACHER"].includes(role)) {
        return res
          .status(400)
          .json({
            message: "Admins can only create STUDENT or TEACHER accounts",
          });
      }

      // Check if user exists
      const existingUser = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const result = await query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
        [name, email, hashedPassword, role]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find user
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    const user = result.rows[0];
    
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/me", authenticate, async (req, res) => {
  res.json(req.user);
});

// Create a public registration endpoint (no authentication required)
app.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    // Check if user exists
    const existingUser = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Special case for admin email
    const role = email === "rhmunna19@gmail.com" ? "ADMIN" : "STUDENT";

    // Create user
    const result = await query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [name, email, hashedPassword, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// PROPOSAL ROUTES
app.post(
  "/proposals",
  authenticate,
  authorize(["STUDENT"]),
  async (req, res) => {
    try {
      // Check if there is an active session
      const activeSessionResult = await query(
        'SELECT * FROM sessions WHERE is_active = TRUE LIMIT 1'
      );

      if (activeSessionResult.rows.length === 0) {
        return res
          .status(400)
          .json({ message: "No active submission session" });
      }

      const { title, abstract, supervisorId, documentUrl } = req.body;

      // Validation
      if (!title || !abstract || !supervisorId || !documentUrl) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if supervisor exists and is a TEACHER
      const supervisorResult = await query(
        'SELECT * FROM users WHERE id = $1 AND role = $2',
        [supervisorId, 'TEACHER']
      );

      if (supervisorResult.rows.length === 0) {
        return res.status(400).json({ message: "Invalid supervisor" });
      }

      // Create proposal
      const proposalResult = await query(
        `INSERT INTO proposals 
        (title, abstract, status, document_url, student_id, supervisor_id) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id, title, abstract, status, document_url, student_id, supervisor_id, created_at, updated_at`,
        [title, abstract, 'PENDING', documentUrl, req.user.id, supervisorId]
      );
      
      const proposal = proposalResult.rows[0];
      
      // Get student and supervisor details
      const studentResult = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [req.user.id]
      );
      
      const supervisorDetailsResult = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [supervisorId]
      );
      
      const student = studentResult.rows[0];
      const supervisor = supervisorDetailsResult.rows[0];

      // Send notification email to supervisor
      await sendEmail(
        supervisor.email,
        "New Thesis Proposal Submitted",
        `Dear ${supervisor.name},\n\nA new thesis proposal "${title}" has been submitted by ${student.name} and requires your review.`,
        `<p>Dear ${supervisor.name},</p>
       <p>A new thesis proposal <strong>"${title}"</strong> has been submitted by ${student.name} and requires your review.</p>
       <p>Please log in to the ThesisTrack system to review this proposal.</p>`
      );

      // Format response to match the format expected by frontend
      const result = {
        ...proposal,
        student: { name: student.name, email: student.email },
        supervisor: { name: supervisor.name, email: supervisor.email }
      };

      res.status(201).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

app.get("/proposals", authenticate, async (req, res) => {
  try {
    let proposals = [];
    let query = '';
    let params = [];

    if (req.user.role === "ADMIN") {
      // Admin sees all proposals
      query = `
        SELECT 
          p.id, p.title, p.abstract, p.status, p.document_url, 
          p.student_id, p.supervisor_id, p.created_at, p.updated_at,
          s.id as student_id, s.name as student_name, s.email as student_email,
          t.id as supervisor_id, t.name as supervisor_name, t.email as supervisor_email
        FROM proposals p
        JOIN users s ON p.student_id = s.id
        JOIN users t ON p.supervisor_id = t.id
        ORDER BY p.created_at DESC
      `;
    } else if (req.user.role === "TEACHER") {
      // Teachers see proposals where they're the supervisor
      query = `
        SELECT 
          p.id, p.title, p.abstract, p.status, p.document_url, 
          p.student_id, p.supervisor_id, p.created_at, p.updated_at,
          s.id as student_id, s.name as student_name, s.email as student_email,
          t.id as supervisor_id, t.name as supervisor_name, t.email as supervisor_email
        FROM proposals p
        JOIN users s ON p.student_id = s.id
        JOIN users t ON p.supervisor_id = t.id
        WHERE p.supervisor_id = $1
        ORDER BY p.created_at DESC
      `;
      params = [req.user.id];
    } else if (req.user.role === "STUDENT") {
      // Students see their own proposals
      query = `
        SELECT 
          p.id, p.title, p.abstract, p.status, p.document_url, 
          p.student_id, p.supervisor_id, p.created_at, p.updated_at,
          s.id as student_id, s.name as student_name, s.email as student_email,
          t.id as supervisor_id, t.name as supervisor_name, t.email as supervisor_email
        FROM proposals p
        JOIN users s ON p.student_id = s.id
        JOIN users t ON p.supervisor_id = t.id
        WHERE p.student_id = $1
        ORDER BY p.created_at DESC
      `;
      params = [req.user.id];
    }

    const result = await query(query, params);
    
    // Get comments for each proposal
    for (const row of result.rows) {
      const commentsResult = await query(
        `SELECT c.id, c.content, c.commenter_id, c.created_at, 
         u.name as commenter_name, u.role as commenter_role
         FROM comments c
         JOIN users u ON c.commenter_id = u.id
         WHERE c.proposal_id = $1
         ORDER BY c.created_at DESC`,
        [row.id]
      );
      
      // Format the data to match expected structure
      proposals.push({
        id: row.id,
        title: row.title,
        abstract: row.abstract,
        status: row.status,
        documentUrl: row.document_url,
        studentId: row.student_id,
        supervisorId: row.supervisor_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        student: {
          id: row.student_id,
          name: row.student_name,
          email: row.student_email
        },
        supervisor: {
          id: row.supervisor_id,
          name: row.supervisor_name,
          email: row.supervisor_email
        },
        comments: commentsResult.rows.map(c => ({
          id: c.id,
          content: c.content,
          commenterId: c.commenter_id,
          createdAt: c.created_at,
          commenter: {
            id: c.commenter_id,
            name: c.commenter_name,
            role: c.commenter_role
          }
        }))
      });
    }

    res.json(proposals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch(
  "/proposals/:id/status",
  authenticate,
  authorize(["TEACHER"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "REVISION_REQUIRED",
      ];

      // Validation
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Valid status is required" });
      }

      // Check if proposal exists and belongs to this supervisor
      const proposalResult = await query(
        `SELECT p.*, s.name as student_name, s.email as student_email
         FROM proposals p
         JOIN users s ON p.student_id = s.id
         WHERE p.id = $1 AND p.supervisor_id = $2`,
        [id, req.user.id]
      );

      if (proposalResult.rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Proposal not found or access denied" });
      }

      const proposal = proposalResult.rows[0];

      // Update proposal status
      const updateResult = await query(
        `UPDATE proposals 
         SET status = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING id, title, abstract, status, document_url, student_id, supervisor_id, created_at, updated_at`,
        [status, id]
      );
      
      const updatedProposal = updateResult.rows[0];
      
      // Get supervisor details
      const supervisorResult = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [req.user.id]
      );
      
      const supervisor = supervisorResult.rows[0];

      // Send notification email to student
      await sendEmail(
        proposal.student_email,
        `Thesis Proposal Status Updated: ${status}`,
        `Dear ${proposal.student_name},\n\nThe status of your thesis proposal has been updated to ${status} by ${req.user.name}.`,
        `<p>Dear ${proposal.student_name},</p>
       <p>The status of your thesis proposal has been updated to <strong>${status}</strong> by ${req.user.name}.</p>
       <p>Please log in to the ThesisTrack system for more details.</p>`
      );

      // Format response
      const result = {
        ...updatedProposal,
        student: {
          name: proposal.student_name,
          email: proposal.student_email
        },
        supervisor: {
          name: supervisor.name,
          email: supervisor.email
        }
      };

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

app.patch(
  "/proposals/:id/assign",
  authenticate,
  authorize(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { supervisorId } = req.body;

      // Validation
      if (!supervisorId) {
        return res.status(400).json({ message: "Supervisor ID is required" });
      }

      // Check if supervisor exists and is a TEACHER
      const supervisor = await query(
        'SELECT * FROM users WHERE id = $1 AND role = $2',
        [supervisorId, 'TEACHER']
      );

      if (supervisor.rows.length === 0) {
        return res.status(400).json({ message: "Invalid supervisor" });
      }

      // Check if proposal exists
      const proposalExists = await query(
        'SELECT * FROM proposals WHERE id = $1',
        [id]
      );

      if (proposalExists.rows.length === 0) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      // Update proposal supervisor
      const updatedProposal = await query(
        `UPDATE proposals 
         SET supervisor_id = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING id, title, abstract, status, document_url, student_id, supervisor_id, created_at, updated_at`,
        [supervisorId, id]
      );

      const proposal = updatedProposal.rows[0];

      // Get supervisor and student details
      const supervisorDetails = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [supervisorId]
      );

      const studentDetails = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [proposal.student_id]
      );

      // Send notification emails
      await sendEmail(
        supervisorDetails.rows[0].email,
        "Thesis Proposal Assigned to You",
        `Dear ${supervisorDetails.rows[0].name},\n\nYou have been assigned as the supervisor for the thesis proposal "${proposal.title}" by ${studentDetails.rows[0].name}.`,
        `<p>Dear ${supervisorDetails.rows[0].name},</p>
       <p>You have been assigned as the supervisor for the thesis proposal <strong>"${proposal.title}"</strong> by ${studentDetails.rows[0].name}.</p>
       <p>Please log in to the ThesisTrack system to review this proposal.</p>`
      );

      await sendEmail(
        studentDetails.rows[0].email,
        "New Supervisor Assigned",
        `Dear ${studentDetails.rows[0].name},\n\n${supervisorDetails.rows[0].name} has been assigned as the supervisor for your thesis proposal.`,
        `<p>Dear ${studentDetails.rows[0].name},</p>
       <p>${supervisorDetails.rows[0].name} has been assigned as the supervisor for your thesis proposal.</p>
       <p>Please log in to the ThesisTrack system for more details.</p>`
      );

      // Format response
      const result = {
        ...proposal,
        supervisor: {
          id: supervisorId,
          name: supervisorDetails.rows[0].name,
          email: supervisorDetails.rows[0].email
        },
        student: {
          id: proposal.student_id,
          name: studentDetails.rows[0].name,
          email: studentDetails.rows[0].email
        }
      };

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// COMMENT ROUTES
app.post(
  "/comments",
  authenticate,
  authorize(["TEACHER", "ADMIN"]),
  async (req, res) => {
    try {
      const { proposalId, content } = req.body;

      // Validation
      if (!proposalId || !content) {
        return res
          .status(400)
          .json({ message: "Proposal ID and content are required" });
      }

      // Check if proposal exists
      const proposalResult = await query(
        `SELECT p.*, s.name as student_name, s.email as student_email,
         t.name as supervisor_name, t.email as supervisor_email
         FROM proposals p
         JOIN users s ON p.student_id = s.id
         JOIN users t ON p.supervisor_id = t.id
         WHERE p.id = $1`,
        [proposalId]
      );

      if (proposalResult.rows.length === 0) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      const proposal = proposalResult.rows[0];

      // Check if the commenter is the supervisor or an admin
      if (
        req.user.role === "TEACHER" &&
        proposal.supervisor_id !== req.user.id
      ) {
        return res
          .status(403)
          .json({ message: "You can only comment on proposals you supervise" });
      }

      // Create comment
      const commentResult = await query(
        `INSERT INTO comments (content, proposal_id, commenter_id)
         VALUES ($1, $2, $3)
         RETURNING id, content, proposal_id, commenter_id, created_at`,
        [content, proposalId, req.user.id]
      );
      
      const comment = commentResult.rows[0];
      
      // Get commenter details
      const commenterResult = await query(
        'SELECT name, role FROM users WHERE id = $1',
        [req.user.id]
      );
      
      const commenter = commenterResult.rows[0];

      // Send notification email to student
      await sendEmail(
        proposal.student_email,
        "New Comment on Your Thesis Proposal",
        `Dear ${proposal.student_name},\n\n${req.user.name} has commented on your thesis proposal "${proposal.title}".`,
        `<p>Dear ${proposal.student_name},</p>
       <p>${req.user.name} has commented on your thesis proposal <strong>"${proposal.title}"</strong>.</p>
       <p>Comment: "${content}"</p>
       <p>Please log in to the ThesisTrack system to view the comment and respond if necessary.</p>`
      );

      // Format response
      const result = {
        ...comment,
        commenter: {
          id: req.user.id,
          name: commenter.name,
          role: commenter.role
        }
      };

      res.status(201).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// SESSION ROUTES
app.post("/sessions", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { name, isActive } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ message: "Session name is required" });
    }

    // If new session is active, deactivate all other sessions
    if (isActive) {
      await query(
        'UPDATE sessions SET is_active = FALSE WHERE is_active = TRUE'
      );
    }

    // Create session
    const sessionResult = await query(
      'INSERT INTO sessions (name, is_active) VALUES ($1, $2) RETURNING *',
      [name, isActive || false]
    );

    res.status(201).json(sessionResult.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/sessions/active", async (req, res) => {
  try {
    const activeSession = await query(
      'SELECT * FROM sessions WHERE is_active = TRUE LIMIT 1'
    );

    if (activeSession.rows.length === 0) {
      return res.status(404).json({ message: "No active session found" });
    }

    res.json(activeSession.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Change the current register endpoint to be a role management endpoint for admins
app.patch(
  "/users/:id/role",
  authenticate,
  authorize(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // Validation
      if (!role || !["STUDENT", "TEACHER", "ADMIN"].includes(role)) {
        return res.status(400).json({ message: "Valid role is required" });
      }

      // Check if user exists
      const userToUpdate = await query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (userToUpdate.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user role
      const userResult = await query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, created_at',
        [role, id]
      );

      res.status(200).json(userResult.rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Add a route for admins to get all users
app.get("/users", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const users = await query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(users.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "File too large. Maximum size is 5MB." });
    }
    return res.status(400).json({ message: "File upload error" });
  }

  console.error(err.stack);
  res.status(500).json({ message: "Server error", error: err.message });
});

// Initialize database before starting server
initializeDatabase().then(() => {
  // Start server
  if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
});

module.exports = app;