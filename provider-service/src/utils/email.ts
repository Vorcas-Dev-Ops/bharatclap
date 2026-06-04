import nodemailer from 'nodemailer';

export const sendEmail = async (options: { email: string; subject: string; message: string }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // This configures host and port automatically for Gmail
    auth: {
      user: process.env.SMTP_EMAIL || 'fixvoadmin@gmail.com',
      pass: process.env.SMTP_PASSWORD, // Must be an App Password
    },
  });

  const mailOptions = {
    from: `"Fixvo Verification Team" <${process.env.SMTP_EMAIL || 'fixvoadmin@gmail.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  try {
    if (process.env.SMTP_PASSWORD) {
      await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${options.email}`);
    } else {
      console.log('--- EMAIL MOCK (No SMTP_PASSWORD configured in .env) ---');
      console.log(`To: ${options.email}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Message:\n${options.message}`);
      console.log('---------------------------------------');
    }
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
  }
};
