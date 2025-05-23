const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = (to, subject, text, html) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
        html,
    };

    return transporter.sendMail(mailOptions);
};

const sendProposalSubmissionEmail = (supervisorEmail, proposalTitle) => {
    const subject = 'New Thesis Proposal Submitted';
    const text = `A new thesis proposal titled "${proposalTitle}" has been submitted.`;
    const html = `<p>A new thesis proposal titled "<strong>${proposalTitle}</strong>" has been submitted.</p>`;

    return sendEmail(supervisorEmail, subject, text, html);
};

const sendProposalStatusEmail = (userEmail, proposalTitle, status) => {
    const subject = `Thesis Proposal Status Update: ${proposalTitle}`;
    const text = `Your thesis proposal titled "${proposalTitle}" has been ${status}.`;
    const html = `<p>Your thesis proposal titled "<strong>${proposalTitle}</strong>" has been <strong>${status}</strong>.</p>`;

    return sendEmail(userEmail, subject, text, html);
};

module.exports = {
    sendProposalSubmissionEmail,
    sendProposalStatusEmail,
};