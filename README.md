# 🎓 ThesisTrack – Final Year Project Proposal & Approval System

> A university web application for managing final year project/thesis proposal submissions, approvals, comments, supervisor assignments, and session control.

🔗 **Live Backend**: [https://thesis-track-backend.vercel.app](https://thesis-track-backend.vercel.app)

---

## 🧰 Tech Stack

- Node.js + Express
- PostgreSQL
- JWT Authentication
- Nodemailer (Email Notifications)
- Hosted on **Vercel**

---

## 📂 API Overview

All API endpoints are prefixed with:


### 🔐 Authentication

#### `POST /auth/signup`
Register a new student (or auto-create admin if using admin email)

```
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret"
}
```

#### `POST /auth/login`
Returns JWT and user info

```
{
  "email": "john@example.com",
  "password": "secret"
}
```

#### `GET /me`
Get current user info
Auth: Bearer token required

### 👤 Users
#### `POST /auth/register`
Admin-only endpoint to create a TEACHER or STUDENT

#### `PATCH /users/:id/role`
Admin-only: Change a user’s role

```
{
  "role": "TEACHER"
}
```
#### `GET /users`
Admin-only: List all users

### 📄 Proposals
#### `POST /proposals`
Student submits a new proposal

```
{
  "title": "AI in Healthcare",
  "abstract": "A study on ML in patient diagnosis",
  "supervisorId": 2,
  "documentUrl": "https://example.com/my-thesis.pdf"
}
```
#### `GET /proposals`
Returns:

Student: their proposals

Teacher: proposals they supervise

Admin: all proposals

#### `PATCH /proposals/:id/status`
Teacher updates proposal status

```
{
  "status": "APPROVED"
}
```

#### `PATCH /proposals/:id/assign`
Admin assigns a supervisor to a proposal

```
{
  "supervisorId": 2
}
```

### 💬 Comments
#### `POST /comments`
Teacher/Admin can comment on a proposal

```
{
  "proposalId": 1,
  "content": "Please clarify the methodology."
}
```

### 📆 Sessions
#### `POST /sessions`
Admin creates a new academic session

```
{
  "name": "Spring 2025",
  "isActive": true
}
```

### `GET /sessions/active`
Fetch the current active session

### 📧 Email Notifications
### 🔔 Sent via Nodemailer for:

- New proposal submissions

- Supervisor assignments

- Proposal status updates

- Comments on proposals

### 🔐 Authentication & Roles

| Role      | Abilities                                                     |
| --------- | ------------------------------------------------------------- |
| `STUDENT` | Submit proposals, view own, receive feedback                  |
| `TEACHER` | Approve/reject proposals, comment, view assigned              |
| `ADMIN`   | Manage users, sessions, assign supervisors, see all proposals |

### 🛡 Environment Variables (.env)
```
DATABASE_URL=postgresql://user:password@host:port/db
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_password
EMAIL_FROM="ThesisTrack <noreply@thesistrack.com>"
EMAIL_HOST=smtp.yourhost.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

### 🏁 Getting Started Locally
```
npm install
npx prisma migrate dev --name init
node index.js
```

### 🧑‍💻 Developer: rhmunna143
Developed by the ThesisTrack team for CSE 3208 Web Engineering Lab.
