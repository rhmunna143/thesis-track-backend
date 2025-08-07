# Product Requirements Document (PRD) - Backend
## ThesisTrack: Project Proposal & Book Review System API

---

## 1. Executive Summary

### Service Overview
The ThesisTrack backend provides a RESTful API service that manages the complete lifecycle of academic project proposals, from submission through review to approval. Built with Node.js and PostgreSQL, it handles authentication, authorization, data persistence, and email notifications.

### Core Responsibilities
- User authentication and role-based access control
- Proposal submission and review workflow management
- Email notifications for status updates
- Data persistence and integrity
- File storage management
- System analytics and reporting

### Current Implementation Status
- ✅ Authentication system (JWT-based)
- ✅ User management with role-based access
- ✅ Proposal CRUD operations
- ✅ Comment system
- ✅ Email notifications
- ✅ Session management
- ⏳ Project book review system (pending)
- ⏳ File storage integration (pending)
- ⏳ Advanced analytics (pending)

---

## 2. System Architecture

### 2.1 High-Level Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│   PostgreSQL    │
│   (Next.js)     │     │   (Node.js)     │     │   (Neon)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Email Service  │
                        │  (Nodemailer)   │
                        └─────────────────┘
```

### 2.2 Technology Stack
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 18.x | JavaScript runtime |
| Framework | Express.js | 4.x | Web application framework |
| Database | PostgreSQL | 14.x | Primary data store |
| Database Host | Neon | - | Serverless Postgres |
| Authentication | JWT | - | Token-based auth |
| Password Hashing | bcrypt | 5.x | Secure password storage |
| Email | Nodemailer | 6.x | Email notifications |
| Validation | Joi/Zod | - | Input validation |
| ORM | Prisma/Knex | - | Database abstraction |

### 2.3 Deployment Architecture
- **Hosting**: Vercel (Serverless Functions)
- **Database**: Neon PostgreSQL (Serverless)
- **File Storage**: Cloudinary/AWS S3 (planned)
- **CDN**: Vercel Edge Network
- **Monitoring**: Vercel Analytics + Custom Logging

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Users     │────▶│  Proposals  │────▶│  Comments   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    
       │                   ▼                    
       │            ┌─────────────┐            
       └───────────▶│  Sessions   │            
                    └─────────────┘            
                           │
                           ▼
                    ┌─────────────┐
                    │ProjectBooks │ (planned)
                    └─────────────┘
```

### 3.2 Database Tables

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(100),
    student_id VARCHAR(50),
    batch VARCHAR(20),
    profile_picture VARCHAR(500),
    bio TEXT,
    expertise TEXT[],
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Proposals Table
```sql
CREATE TABLE proposals (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    abstract TEXT NOT NULL,
    keywords TEXT[],
    methodology TEXT,
    status proposal_status DEFAULT 'PENDING',
    document_url VARCHAR(500) NOT NULL,
    student_id INTEGER REFERENCES users(id),
    supervisor_id INTEGER REFERENCES users(id),
    co_supervisor_id INTEGER REFERENCES users(id),
    session_id INTEGER REFERENCES sessions(id),
    team_members JSONB,
    reviewed_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Sessions Table
```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    semester VARCHAR(20),
    is_active BOOLEAN DEFAULT false,
    submission_deadline TIMESTAMP,
    review_deadline TIMESTAMP,
    max_proposals_per_student INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Comments Table
```sql
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
    commenter_id INTEGER REFERENCES users(id),
    parent_comment_id INTEGER REFERENCES comments(id),
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Project Books Table (Planned)
```sql
CREATE TABLE project_books (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER REFERENCES proposals(id),
    document_url VARCHAR(500) NOT NULL,
    presentation_url VARCHAR(500),
    source_code_url VARCHAR(500),
    status book_status DEFAULT 'PENDING',
    review_score INTEGER,
    review_comments TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    submitted_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP
);
```

#### Notifications Table (Planned)
```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.3 Enums
```sql
CREATE TYPE user_role AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
CREATE TYPE proposal_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');
CREATE TYPE book_status AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE notification_type AS ENUM ('PROPOSAL_SUBMITTED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'DEADLINE_REMINDER');
```

---

## 4. API Specifications

### 4.1 API Design Principles
- RESTful architecture
- JSON request/response format
- JWT-based authentication
- Consistent error handling
- Pagination for list endpoints
- Rate limiting per endpoint
- API versioning (v1)

### 4.2 Authentication Endpoints

#### POST /auth/signup
**Description**: Public registration for students  
**Request Body**:
```json
{
    "name": "string",
    "email": "string",
    "password": "string",
    "department": "string",
    "studentId": "string",
    "batch": "string"
}
```
**Response**: 201 Created
```json
{
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "STUDENT",
    "emailVerificationSent": true
}
```

#### POST /auth/login
**Description**: User authentication  
**Request Body**:
```json
{
    "email": "string",
    "password": "string"
}
```
**Response**: 200 OK
```json
{
    "token": "string",
    "refreshToken": "string",
    "user": {
        "id": "number",
        "name": "string",
        "email": "string",
        "role": "string"
    }
}
```

#### POST /auth/refresh
**Description**: Refresh access token  
**Request Body**:
```json
{
    "refreshToken": "string"
}
```

#### POST /auth/forgot-password
**Description**: Request password reset  
**Request Body**:
```json
{
    "email": "string"
}
```

#### POST /auth/reset-password
**Description**: Reset password with token  
**Request Body**:
```json
{
    "token": "string",
    "newPassword": "string"
}
```

#### POST /auth/verify-email
**Description**: Verify email address  
**Request Body**:
```json
{
    "token": "string"
}
```

### 4.3 User Management Endpoints

#### GET /users/profile
**Description**: Get current user profile  
**Headers**: Authorization: Bearer {token}  
**Response**: 200 OK

#### PUT /users/profile
**Description**: Update user profile  
**Headers**: Authorization: Bearer {token}  
**Request Body**:
```json
{
    "name": "string",
    "department": "string",
    "bio": "string",
    "expertise": ["string"],
    "profilePicture": "string"
}
```

#### GET /users
**Description**: Get all users (Admin only)  
**Headers**: Authorization: Bearer {token}  
**Query Params**:
- page (default: 1)
- limit (default: 20)
- role (filter)
- department (filter)
- search (name/email)

#### GET /users/:id
**Description**: Get user by ID  
**Headers**: Authorization: Bearer {token}

#### PUT /users/:id/role
**Description**: Update user role (Admin only)  
**Headers**: Authorization: Bearer {token}  
**Request Body**:
```json
{
    "role": "STUDENT|TEACHER|ADMIN"
}
```

#### DELETE /users/:id
**Description**: Deactivate user (Admin only)  
**Headers**: Authorization: Bearer {token}

### 4.4 Proposal Endpoints

#### GET /proposals
**Description**: Get proposals based on user role  
**Headers**: Authorization: Bearer {token}  
**Query Params**:
- page (default: 1)
- limit (default: 20)
- status (filter)
- sessionId (filter)
- departmentId (filter)
- supervisorId (filter)
- search (title/abstract)
- sortBy (created_at|updated_at|title)
- order (asc|desc)

**Response**: 200 OK
```json
{
    "data": [{
        "id": "number",
        "title": "string",
        "abstract": "string",
        "status": "string",
        "documentUrl": "string",
        "student": {},
        "supervisor": {},
        "comments": [],
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
    }],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 100,
        "totalPages": 5
    }
}
```

#### POST /proposals
**Description**: Submit new proposal (Student only)  
**Headers**: Authorization: Bearer {token}  
**Request Body**:
```json
{
    "title": "string",
    "abstract": "string",
    "keywords": ["string"],
    "methodology": "string",
    "supervisorId": "number",
    "coSupervisorId": "number",
    "documentUrl": "string",
    "teamMembers": [{
        "name": "string",
        "email": "string",
        "studentId": "string"
    }]
}
```

#### GET /proposals/:id
**Description**: Get proposal details  
**Headers**: Authorization: Bearer {token}

#### PUT /proposals/:id
**Description**: Update proposal (Student only, if pending)  
**Headers**: Authorization: Bearer {token}

#### PATCH /proposals/:id/status
**Description**: Update proposal status (Teacher only)  
**Headers**: Authorization: Bearer {token}  
**Request Body**:
```json
{
    "status": "APPROVED|REJECTED|REVISION_REQUIRED",
    "comments": "string"
}
```

#### DELETE /proposals/:id
**Description**: Delete proposal (Student only, if pending)  
**Headers**: Authorization: Bearer {token}

#### POST /proposals/:id/assign
**Description**: Assign/reassign supervisor (Admin only)  
**Headers**: Authorization: Bearer {token}  
**Request Body**:
```json
{
    "supervisorId": "number"
}
```

### 4.5 Comment Endpoints

#### GET /proposals/:id/comments
**Description**: Get proposal comments  
**Headers**: Authorization: Bearer {token}

#### POST /proposals/:id/comments
**Description**: Add comment to proposal  
**Headers**: Authorization: Bearer {token}  
**Request Body**:
```json
{
    "content": "string",
    "parentCommentId": "number"
}
```

#### PUT /comments/:id
**Description**: Edit comment  
**Headers**: Authorization: Bearer {token}

#### DELETE /comments/:id
**Description**: Delete comment  
**Headers**: Authorization: Bearer {token}

#### PATCH /comments/:id/resolve
**Description**: Mark comment as resolved  
**Headers**: Authorization: Bearer {token}

### 4.6 Session Endpoints

#### GET /sessions
**Description**: Get all sessions  
**Headers**: Authorization: Bearer {token}

#### GET /sessions/active
**Description**: Get current active session

#### POST /sessions
**Description**: Create new session (Admin only)  
**Headers**: Authorization: Bearer {token}  
**Request Body**:
```json
{
    "name": "string",
    "year": "number",
    "semester": "string",
    "isActive": "boolean",
    "submissionDeadline": "timestamp",
    "reviewDeadline": "timestamp",
    "maxProposalsPerStudent": "number"
}
```

#### PUT /sessions/:id
**Description**: Update session (Admin only)  
**Headers**: Authorization: Bearer {token}

#### PATCH /sessions/:id/activate
**Description**: Set session as active (Admin only)  
**Headers**: Authorization: Bearer {token}

### 4.7 File Upload Endpoints (Planned)

#### POST /upload/document
**Description**: Upload proposal document  
**Headers**: Authorization: Bearer {token}  
**Request**: multipart/form-data  
**Response**: 
```json
{
    "url": "string",
    "size": "number",
    "mimeType": "string"
}
```

#### POST /upload/image
**Description**: Upload profile picture  
**Headers**: Authorization: Bearer {token}  
**Request**: multipart/form-data

#### DELETE /upload/:id
**Description**: Delete uploaded file  
**Headers**: Authorization: Bearer {token}

### 4.8 Analytics Endpoints (Planned)

#### GET /analytics/dashboard
**Description**: Get role-based dashboard data  
**Headers**: Authorization: Bearer {token}

#### GET /analytics/proposals
**Description**: Get proposal statistics  
**Headers**: Authorization: Bearer {token}  
**Query Params**:
- startDate
- endDate
- groupBy (status|department|supervisor)

#### GET /analytics/users
**Description**: Get user statistics (Admin only)  
**Headers**: Authorization: Bearer {token}

#### GET /analytics/export
**Description**: Export data to Excel/CSV  
**Headers**: Authorization: Bearer {token}  
**Query Params**:
- format (excel|csv)
- type (proposals|users|sessions)

---

## 5. Business Logic & Workflows

### 5.1 Proposal Submission Workflow
```
Student Submits → Check Active Session → Validate Supervisor
    ↓                                           ↓
Create Proposal → Send Email to Supervisor → Update Dashboard
    ↓
Return Proposal ID → Create Notification → Log Activity
```

### 5.2 Proposal Review Workflow
```
Teacher Opens Proposal → Load PDF & Details → Add Comments
    ↓                           ↓                  ↓
Update Status → Send Email to Student → Update Analytics
    ↓
Log Review Time → Create Notification → Update Dashboard
```

### 5.3 Role-Based Access Control (RBAC)

#### Permission Matrix
| Resource | Action | Student | Teacher | Admin |
|----------|--------|---------|---------|--------|
| Proposals | Create | ✅ (own) | ❌ | ❌ |
| Proposals | Read | ✅ (own) | ✅ (assigned) | ✅ (all) |
| Proposals | Update | ✅ (own, pending) | ✅ (status only) | ✅ (all) |
| Proposals | Delete | ✅ (own, pending) | ❌ | ✅ (all) |
| Comments | Create | ❌ | ✅ | ✅ |
| Comments | Read | ✅ (own proposal) | ✅ | ✅ |
| Users | Create | ❌ | ❌ | ✅ |
| Users | Update Role | ❌ | ❌ | ✅ |
| Sessions | Manage | ❌ | ❌ | ✅ |
| Analytics | View | ✅ (limited) | ✅ (department) | ✅ (all) |

### 5.4 Email Notification Triggers

#### Automated Emails
1. **Proposal Submitted**: To supervisor
2. **Status Changed**: To student
3. **Comment Added**: To student
4. **Supervisor Assigned**: To both parties
5. **Deadline Reminder**: To all pending (24h before)
6. **Account Created**: Welcome email
7. **Password Reset**: Reset link
8. **Email Verification**: Verification link

#### Email Templates
```javascript
// Proposal Submitted
{
    subject: "New Thesis Proposal: {title}",
    to: supervisor.email,
    cc: admin.email,
    template: "proposal-submitted",
    data: {
        supervisorName: string,
        studentName: string,
        proposalTitle: string,
        abstract: string,
        submissionDate: date,
        reviewLink: string
    }
}
```

### 5.5 Validation Rules

#### Proposal Validation
- Title: 10-200 characters, no special characters
- Abstract: 500-2000 words
- Keywords: 3-10 keywords, alphanumeric only
- Document: PDF only, max 10MB
- Team Members: Max 4 for group projects
- Supervisor: Must be active teacher in same department

#### User Validation
- Email: Valid university domain (@university.edu)
- Password: Min 8 chars, 1 uppercase, 1 number, 1 special
- Name: 2-100 characters, letters and spaces only
- Student ID: Alphanumeric, 6-20 characters
- Department: From predefined list

### 5.6 Business Rules

#### Proposal Rules
1. One active proposal per student per session
2. Cannot submit if previous proposal pending
3. Cannot edit after approval/rejection
4. Revision required allows resubmission
5. Supervisor must be from same/related department
6. Group projects require all members confirmed

#### Session Rules
1. Only one active session at a time
2. Cannot delete session with proposals
3. Deadlines must be in future
4. Review deadline > submission deadline
5. Archive sessions after 2 years

#### User Rules
1. Email must be unique
2. Cannot delete users with proposals
3. Teachers need admin approval
4. Students auto-approved with valid email
5. Inactive after 6 months no login

---

## 6. Security Requirements

### 6.1 Authentication & Authorization
- **JWT Token Management**
  - Access token: 15 minutes expiry
  - Refresh token: 7 days expiry
  - Token rotation on refresh
  - Blacklist on logout
  - Secure httpOnly cookies

### 6.2 Data Protection
- **Encryption**
  - Passwords: bcrypt (12 rounds)
  - Database: TLS in transit
  - Files: Encrypted at rest
  - API: HTTPS only
  
- **Data Privacy**
  - PII masking in logs
  - GDPR compliance
  - Data retention policy
  - Right to deletion

### 6.3 Security Headers
```javascript
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
```

### 6.4 Input Validation & Sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention (HTML escaping)
- File type validation (magic numbers)
- Request size limits
- Rate limiting per endpoint
- Input length validation

### 6.5 API Security
- **Rate Limiting**
  ```javascript
  {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      endpoints: {
          '/auth/login': 5,
          '/auth/signup': 3,
          '/upload': 10
      }
  }
  ```

- **CORS Configuration**
  ```javascript
  {
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
  }
  ```

### 6.6 Audit Logging
```javascript
// Audit log structure
{
    userId: number,
    action: string,
    resource: string,
    resourceId: number,
    ipAddress: string,
    userAgent: string,
    timestamp: timestamp,
    changes: jsonb,
    status: 'success' | 'failure'
}
```

---

## 7. Performance Requirements

### 7.1 Response Time SLAs
| Endpoint Type | Target | Maximum |
|--------------|--------|---------|
| Authentication | 200ms | 500ms |
| Simple GET | 100ms | 300ms |
| Complex GET (with joins) | 300ms | 800ms |
| POST/PUT | 200ms | 500ms |
| File Upload | 2s | 5s |
| Analytics | 500ms | 2s |

### 7.2 Scalability Targets
- Concurrent users: 1000+
- Requests per second: 500
- Database connections: 100 (pooled)
- File storage: 100GB
- Email queue: 1000/hour

### 7.3 Optimization Strategies

#### Database Optimization
```sql
-- Indexes
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_session ON proposals(session_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Composite indexes
CREATE INDEX idx_proposals_student_status ON proposals(student_id, status);
CREATE INDEX idx_proposals_supervisor_status ON proposals(supervisor_id, status);

-- Full-text search
CREATE INDEX idx_proposals_search ON proposals USING gin(to_tsvector('english', title || ' ' || abstract));
```

#### Caching Strategy
- Redis for session storage
- Cache user profiles (5 min)
- Cache proposal counts (1 min)
- Cache analytics (10 min)
- CDN for static files

#### Query Optimization
```javascript
// Use pagination
const proposals = await db.proposals.findMany({
    skip: (page - 1) * limit,
    take: limit,
    include: {
        student: {
            select: { id: true, name: true, email: true }
        },
        supervisor: {
            select: { id: true, name: true, email: true }
        }
    }
});

// Use selective fields
const users = await db.users.findMany({
    select: {
        id: true,
        name: true,
        email: true,
        role: true
    }
});
```

---

## 8. Error Handling

### 8.1 Error Response Format
```json
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable message",
        "details": {
            "field": "Additional context"
        },
        "timestamp": "2025-01-15T10:30:00Z",
        "requestId": "uuid"
    }
}
```

### 8.2 Error Codes
| Code | HTTP Status | Description |
|------|------------|-------------|
| AUTH_REQUIRED | 401 | Authentication required |
| AUTH_INVALID | 401 | Invalid credentials |
| AUTH_EXPIRED | 401 | Token expired |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Input validation failed |
| DUPLICATE_ENTRY | 409 | Resource already exists |
| RATE_LIMIT | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily down |

### 8.3 Error Handling Middleware
```javascript
const errorHandler = (err, req, res, next) => {
    const error = {
        code: err.code || 'SERVER_ERROR',
        message: err.message || 'An error occurred',
        timestamp: new Date().toISOString(),
        requestId: req.id
    };

    // Log error
    logger.error({
        ...error,
        stack: err.stack,
        userId: req.user?.id,
        method: req.method,
        url: req.url,
        ip: req.ip
    });

    // Send response
    res.status(err.status || 500).json({ error });
};
```

---

## 9. Testing Strategy

### 9.1 Test Coverage Requirements
- Unit tests: 80% minimum
- Integration tests: Core workflows
- E2E tests: Critical paths
- Load tests: Performance validation
- Security tests: OWASP Top 10

### 9.2 Test Structure
```
tests/
├── unit/
│   ├── auth/
│   ├── proposals/
│   ├── users/
│   └── utils/
├── integration/
│   ├── workflows/
│   └── api/
├── e2e/
│   ├── student-flow.test.js
│   ├── teacher-flow.test.js
│   └── admin-flow.test.js
├── load/
│   └── k6-scripts/
└── fixtures/
    └── test-data.js
```

### 9.3 Testing Tools
- **Unit Testing**: Jest
- **Integration Testing**: Supertest
- **E2E Testing**: Playwright
- **Load Testing**: K6
- **Security Testing**: OWASP ZAP
- **Code Coverage**: Istanbul

---

## 10. Monitoring & Logging

### 10.1 Logging Strategy

#### Log Levels
```javascript
{
    error: 'System errors, failures',
    warn: 'Deprecations, high memory',
    info: 'Requests, responses',
    debug: 'Detailed execution flow',
    trace: 'Full data dumps'
}
```

#### Structured Logging
```javascript
logger.info({
    type: 'API_REQUEST',
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    duration: responseTime,
    status: res.statusCode,
    ip: req.ip,
    userAgent: req.headers['user-agent']
});
```

### 10.2 Metrics to Monitor
- **Application Metrics**
  - Request rate
  - Response time (p50, p95, p99)
  - Error rate
  - Active users
  - Proposal submission rate

- **System Metrics**
  - CPU usage
  - Memory usage
  - Database connections
  - Disk I/O
  - Network I/O

- **Business Metrics**
  - Proposals per day
  - Average review time
  - Approval rate
  - User growth
  - Session activity

### 10.3 Alerting Rules
| Metric | Threshold | Action |
|--------|-----------|---------|
| Error rate | > 5% | Page on-call |
| Response time p95 | > 2s | Email team |
| CPU usage | > 80% | Auto-scale |
| Memory usage | > 90% | Restart service |
| Database connections | > 80 | Alert DBA |
| Failed logins | > 10/min | Security alert |

---

## 11. Deployment & DevOps

### 11.1 Environment Configuration
```bash
# .env.development
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/thesistrack_dev
JWT_SECRET=dev-secret-key
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525

# .env.production
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@neon.tech/thesistrack
JWT_SECRET=${SECRET_KEY}
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
```

### 11.2 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
stages:
  - lint
  - test
  - build
  - deploy

lint:
  - ESLint
  - Prettier
  - Security audit

test:
  - Unit tests
  - Integration tests
  - Coverage report

build:
  - Docker image
  - Database migrations

deploy:
  - Staging (auto)
  - Production (manual)
```

### 11.3 Database Migrations
```javascript
// migrations/001_initial_schema.js
exports.up = async (knex) => {
    await knex.schema.createTable('users', ...);
    await knex.schema.createTable('proposals', ...);
};

exports.down = async (knex) => {
    await knex.schema.dropTable('proposals');
    await knex.schema.dropTable('users');
};
```

---

## 12. API Documentation

### 12.1 OpenAPI/Swagger Specification
```yaml
openapi: 3.0.0
info:
  title: ThesisTrack API
  version: 1.0.0
  description: Academic proposal management system

servers:
  - url: https://api.thesistrack.com/v1
    description: Production
  - url: http://localhost:5000/v1
    description: Development

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

paths:
  /auth/login:
    post:
      summary: User login
      tags: [Authentication]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
```

### 12.2 API Versioning Strategy
- URL versioning: `/v1/`, `/v2/`
- Deprecation notice: 6 months
- Backward compatibility: 1 version
- Migration guides provided

---

## 13. Future Enhancements

### Phase 2 Features (Q2 2025)
- [ ] Project book review system
- [ ] File storage integration (S3/Cloudinary)
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced search with filters
- [ ] Batch operations for admins
- [ ] Export functionality (PDF/Excel)

### Phase 3 Features (Q3 2025)
- [ ] AI-powered proposal analysis
- [ ] Plagiarism detection
- [ ] Meeting scheduler
- [ ] Mobile API optimization
- [ ] GraphQL API option
- [ ] Webhook integrations

### Phase 4 Features (Q4 2025)
- [ ] Multi-university support
- [ ] Department hierarchy
- [ ] Custom workflows
- [ ] Advanced analytics dashboard
- [ ] API marketplace
- [ ] Third-party integrations

---

## 14. Support & Maintenance

### 14.1 SLA Commitments
- Uptime: 99.9% (43.2 minutes/month)
- Response time: < 500ms (95th percentile)
- Bug fix: Critical (4h), High (24h), Medium (1 week)
- Security patches: Within 24 hours
- Data backup: Daily, 30-day retention

### 14.2 Maintenance Windows
- Scheduled: Sunday 2-4 AM (local time)
- Emergency: As needed with notice
- Database maintenance: Monthly
- Security updates: Weekly
- Performance tuning: Quarterly

---

## 15. Compliance & Legal

### 15.1 Data Compliance
- GDPR compliant
- FERPA compliant (educational records)
- PCI DSS (if payment integration)
- SOC 2 Type II (planned)

### 15.2 Data Retention Policy
- Active data: Indefinite
- Deleted accounts: 30 days
- Logs: 90 days
- Backups: 1 year
- Audit trails: 7 years