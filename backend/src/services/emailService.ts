import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configure email transporter
let transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const EmailService = {
  /**
   * Send an email
   */
  sendEmail: async (options: EmailOptions): Promise<boolean> => {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@tontine-app.com',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };
      
      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  },
  
  /**
   * Send a payment reminder email
   */
  sendPaymentReminder: async (
    userEmail: string, 
    userName: string, 
    groupName: string, 
    amount: number, 
    dueDate: string,
    cycleIndex: number
  ): Promise<boolean> => {
    const subject = `Payment Reminder: ${groupName} Cycle #${cycleIndex}`;
    
    const text = `
Hello ${userName},

This is a reminder that your payment of $${amount.toFixed(2)} for ${groupName} (Cycle #${cycleIndex}) is due by ${dueDate}.

Please log in to the Tontine App to make your payment.

Thank you,
The Tontine App Team
    `;
    
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #4CAF50;">Payment Reminder</h2>
  <p>Hello ${userName},</p>
  <p>This is a reminder that your payment for the following group is due:</p>
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p><strong>Group:</strong> ${groupName}</p>
    <p><strong>Cycle:</strong> #${cycleIndex}</p>
    <p><strong>Amount Due:</strong> $${amount.toFixed(2)}</p>
    <p><strong>Due By:</strong> ${dueDate}</p>
  </div>
  <p>Please log in to the Tontine App to make your payment.</p>
  <div style="margin-top: 30px; text-align: center;">
    <a href="https://tontine-app.com" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Open Tontine App</a>
  </div>
  <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
    If you've already made this payment, please disregard this message.
  </p>
</div>
    `;
    
    return await EmailService.sendEmail({
      to: userEmail,
      subject,
      text,
      html
    });
  }
};