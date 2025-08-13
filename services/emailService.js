const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // companytestudo@gmail.com
    pass: process.env.EMAIL_PASS  // your gmail app password
  }
});

// Email templates
const emailTemplates = {
  verification: (username, verificationLink) => ({
    subject: 'Verify Your Email - Testudo Flashcards',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f7fa; padding: 20px;">
        <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1aac83; margin: 0; font-size: 2em;">🐢 Testudo</h1>
          </div>
          
          <h2 style="color: #343a40; margin-bottom: 20px;">Welcome ${username}!</h2>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
            Thanks for signing up for Testudo! To get started with creating and studying flashcards, 
            please verify your email address by clicking the button below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background: linear-gradient(45deg, #1aac83, #158f6b); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block;
                      font-weight: 600;
                      font-size: 1.1em;">
              ✅ Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            If the button doesn't work, copy and paste this link in your browser:
          </p>
          <p style="color: #1aac83; word-break: break-all; font-size: 0.9em;">
            ${verificationLink}
          </p>
          
          <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px;">
            <p style="color: #666; font-size: 0.85em; margin: 0;">
              This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </div>
      </div>
    `
  }),
  
  passwordReset: (username, resetLink) => ({
    subject: 'Reset Your Password - Testudo Flashcards',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f7fa; padding: 20px;">
        <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1aac83; margin: 0; font-size: 2em;">🐢 Testudo</h1>
          </div>
          
          <h2 style="color: #343a40; margin-bottom: 20px;">Hi ${username},</h2>
          
          <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
            You requested a password reset for your Testudo account. Click the button below to set a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: linear-gradient(45deg, #e7195a, #c21546); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block;
                      font-weight: 600;
                      font-size: 1.1em;">
              🔒 Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            If the button doesn't work, copy and paste this link in your browser:
          </p>
          <p style="color: #e7195a; word-break: break-all; font-size: 0.9em;">
            ${resetLink}
          </p>
          
          <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px;">
            <p style="color: #666; font-size: 0.85em; margin: 0;">
              This link expires in 1 hour. If you didn't request this reset, you can safely ignore this email.
            </p>
          </div>
        </div>
      </div>
    `
  })
};

// Send email function
const sendEmail = async (to, templateType, templateData) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Email configuration missing');
      return { success: false, error: 'Email service not configured' };
    }

    const template = emailTemplates[templateType](templateData.username, templateData.link);
    
    const mailOptions = {
      from: `"Testudo Flashcards" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: template.subject,
      html: template.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Email error:', error);
    return { success: false, error: error.message };
  }
};

// Test email connection
const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Email connection failed:', error);
    return false;
  }
};

module.exports = { 
  sendEmail, 
  testEmailConnection 
};

// Test file (backend/test-email.js) - Run this to verify email works
/*
require('dotenv').config();
const { sendEmail, testEmailConnection } = require('./services/emailService');

const testEmail = async () => {
  console.log('🧪 Testing email service...');
  
  // Test connection first
  const connected = await testEmailConnection();
  if (!connected) {
    console.log('❌ Email connection failed');
    return;
  }

  // Test sending email
  const result = await sendEmail(
    'companytestudo@gmail.com', // send to yourself for testing
    'verification',
    {
      username: 'testuser',
      link: 'http://localhost:3000/verify/test123'
    }
  );
  
  if (result.success) {
    console.log('✅ Test email sent successfully!');
    console.log('Check the companytestudo@gmail.com inbox');
  } else {
    console.log('❌ Test email failed:', result.error);
  }
};

testEmail();
*/