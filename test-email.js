require('dotenv').config();
const { sendEmail, testEmailConnection } = require('./services/emailService');

const testEmail = async () => {
  console.log('🧪 Testing email service...');
  
  const connected = await testEmailConnection();
  if (!connected) return;

  const result = await sendEmail(
    'companytestudo@gmail.com',
    'verification',
    {
      username: 'testuser', 
      link: 'http://localhost:3000/verify/test123'
    }
  );
  
  console.log(result.success ? '✅ Success!' : '❌ Failed:', result.error);
};

testEmail();