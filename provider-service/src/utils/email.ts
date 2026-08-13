import nodemailer from 'nodemailer';

export const sendEmail = async (options: { email: string; subject: string; message: string }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // This configures host and port automatically for Gmail
    auth: {
      user: process.env.SMTP_EMAIL || 'bharatclapadmin@gmail.com',
      pass: process.env.SMTP_PASSWORD, // Must be an App Password
    },
  });

  const mailOptions = {
    from: `"BharatClap Verification Team" <${process.env.SMTP_EMAIL || 'bharatclapadmin@gmail.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  try {
    if (process.env.SMTP_PASSWORD) {
      await transporter.sendMail(mailOptions);
      /* ponytail: P0-2 PII audit fix - mask recipient email */
      console.log(`Email dispatched successfully to user recipient`);
    } else {
      console.log('--- EMAIL MOCK (No SMTP_PASSWORD configured in .env) ---');
      console.log(`Subject: ${options.subject}`);
      console.log('--- EMAIL CONTENT OMITTED FOR PII SECURITY ---');
      console.log('---------------------------------------');
    }
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
  }
};
