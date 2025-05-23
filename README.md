# ThesisTrack – Final Year Project Proposal & Approval System

## Overview
ThesisTrack is a web application designed to facilitate the proposal and approval process for final year projects. It allows students to submit their project proposals, which can then be reviewed and approved by teachers and administrators. The system includes user authentication, role-based access control, and email notifications for various actions.

## Features
- User authentication with JWT
- Role management (STUDENT, TEACHER, ADMIN)
- Proposal submission and management
- Commenting system for proposals
- Email notifications for proposal status changes
- File uploads for thesis proposals (PDF format)

## Technologies Used
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT for authentication
- Bcrypt for password hashing
- Nodemailer for email notifications
- Multer for file uploads
- dotenv for environment variable management

## Folder Structure
```
thesis-track-backend
├── src
│   ├── controllers
│   ├── routes
│   ├── middlewares
│   ├── services
│   ├── utils
│   ├── prisma
│   ├── config
│   ├── uploads
│   ├── app.js
│   └── server.js
├── prisma
│   └── schema.prisma
├── .env
├── .gitignore
├── package.json
├── jest.config.js
└── README.md
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd thesis-track-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the environment variables:
   - Create a `.env` file in the root directory and add your database connection string and JWT secret.

4. Run the database migrations:
   ```
   npx prisma migrate dev
   ```

5. Start the server:
   ```
   npm start
   ```

## API Endpoints
- **Authentication**
  - `POST /auth/register` - Admin can create users
  - `POST /auth/login` - User login
  - `GET /me` - Get current user info
  - `GET /users` - Admin-only route to list users

- **Proposals**
  - `POST /proposals` - Student creates proposal (upload PDF, send email to supervisor)
  - `GET /proposals` - List proposals based on user role
  - `PATCH /proposals/:id/status` - Teacher updates proposal status
  - `POST /comments` - Teacher comments on a proposal

- **Sessions**
  - `POST /sessions` - Admin creates new session
  - `GET /sessions/active` - Get currently active session
  - `PATCH /proposals/:id/assign` - Admin assigns supervisor to a proposal

## File Uploads
Uploaded proposal files are stored in the `/uploads` directory. Only PDF files are accepted, with a maximum size of 5MB.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License.