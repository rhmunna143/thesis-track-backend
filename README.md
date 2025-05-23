# ThesisTrack Backend

A comprehensive REST API for managing thesis proposals and supervision workflows.

## Overview

ThesisTrack is a full-featured backend system that supports the entire thesis proposal, supervision, and approval workflow. It includes features for document uploads, role-based access control, email notifications, and comment systems.

## Features

- User authentication with JWT
- Role-based access control (Student, Teacher, Admin)
- File uploads (PDF only)
- Email notifications for important events
- Session management for proposal submissions
- Comment system for proposal feedback
- Comprehensive API endpoints for all operations

## Technologies Used

- Node.js & Express.js
- PostgreSQL with Prisma ORM
- JSON Web Tokens (JWT) for authentication
- bcrypt for secure password hashing
- Multer for file uploads
- Nodemailer for email notifications
- dotenv for environment variables

## Setup & Installation

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- SMTP server for emails

### Installation

1. Clone the repository
git clone https://github.com/yourusername/thesis-track-backend.git cd thesis-track-backend
2. Install dependencies
npm install
3. Create a `.env` file (see Environment Variables section)

4. Set up the database
npx prisma migrate dev --name init
npx prisma migrate dev --name init
5. Seed the database (optional)
npx prisma db seed
6. Start the server

## Usage

### Environment Variables

Create a `.env` file in the root directory with the following variables:

- `DATABASE_URL`: Connection string for your PostgreSQL database
- `JWT_SECRET`: Secret key for signing JWT tokens
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password
- `FRONTEND_URL`: URL of the frontend application (for CORS and email links)

### API Documentation

API documentation is available at `http://localhost:3000/docs` after starting the server. It provides details on all available endpoints, request/response formats, and authentication methods.

### Frontend Integration

ThesisTrack is designed to be used with the ThesisTrack frontend application. Ensure that the frontend is configured to use the correct API URL and JWT secret.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/YourFeature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feature/YourFeature`)
6. Create a pull request

Please ensure that your code adheres to the existing style and includes appropriate tests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by the need for a streamlined thesis management process
- Thanks to all contributors and open-source libraries that made this project possible
