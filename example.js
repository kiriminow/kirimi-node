const Kirimi = require('./index');

// Initialize client with your credentials
const client = new Kirimi(
  process.env.KIRIMI_USER_CODE || 'your_user_code',
  process.env.KIRIMI_SECRET_KEY || 'your_secret_key'
);

const DEVICE_ID = process.env.KIRIMI_DEVICE_ID || 'your_device_id';
const TEST_PHONE = process.env.TEST_PHONE || '628123456789';

async function demonstrateKirimiFeatures() {
  console.log('🚀 Kirimi Node.js Client Demo\n');

  try {
    // 1. Health Check
    console.log('1. Checking API health...');
    const health = await client.healthCheck();
    console.log('✅ API Status:', health);
    console.log('');

    // 2. Send Text Message
    console.log('2. Sending text message...');
    const textResult = await client.sendMessage(
      DEVICE_ID,
      TEST_PHONE,
      'Hello from Kirimi Node.js Client! 🎉'
    );
    console.log('✅ Text message sent:', textResult);
    console.log('');

    // 3. Send Media Message
    console.log('3. Sending media message...');
    const mediaResult = await client.sendMessage(
      DEVICE_ID,
      TEST_PHONE,
      'Here is a sample image! 📸',
      'https://picsum.photos/300/200'
    );
    console.log('✅ Media message sent:', mediaResult);
    console.log('');

    // 4. Generate OTP (requires Basic or Pro package)
    console.log('4. Generating OTP...');
    try {
      const otpResult = await client.generateOTP(DEVICE_ID, TEST_PHONE);
      console.log('✅ OTP generated:', otpResult);
      
      // Simulate user entering OTP (in real app, this would come from user input)
      console.log('5. Validating OTP (demo with code "123456")...');
      try {
        const validateResult = await client.validateOTP(DEVICE_ID, TEST_PHONE, '123456');
        console.log('✅ OTP validated:', validateResult);
      } catch (error) {
        console.log('ℹ️ OTP validation failed (expected for demo):', error.message);
      }
    } catch (error) {
      console.log('ℹ️ OTP generation failed (requires Basic/Pro package):', error.message);
    }
    console.log('');

    console.log('🎉 Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.log('\nPlease make sure you have:');
    console.log('- Valid user code and secret key');
    console.log('- A connected device');
    console.log('- Sufficient quota');
    console.log('- Correct environment variables or update the credentials in this file');
  }
}

// OTP Service Example Class
class OTPService {
  constructor(userCode, secret, deviceId) {
    this.client = new Kirimi(userCode, secret);
    this.deviceId = deviceId;
  }

  async sendVerificationCode(phoneNumber) {
    try {
      const result = await this.client.generateOTP(this.deviceId, phoneNumber);
      console.log(`OTP sent to ${phoneNumber}:`, result);
      return { success: true, data: result };
    } catch (error) {
      console.error('Failed to send OTP:', error.message);
      return { success: false, error: error.message };
    }
  }

  async verifyCode(phoneNumber, code) {
    try {
      const result = await this.client.validateOTP(this.deviceId, phoneNumber, code);
      return { success: true, verified: result.verified, data: result };
    } catch (error) {
      console.error('Failed to verify OTP:', error.message);
      return { success: false, verified: false, error: error.message };
    }
  }
}

// Notification Service Example Class
class NotificationService {
  constructor(userCode, secret, deviceId) {
    this.client = new Kirimi(userCode, secret);
    this.deviceId = deviceId;
  }

  async sendWelcomeMessage(phoneNumber, userName) {
    const message = `Welcome ${userName}! 🎉\n\nThank you for joining our service. We're excited to have you!`;
    
    try {
      const result = await this.client.sendMessage(this.deviceId, phoneNumber, message);
      return { success: true, data: result };
    } catch (error) {
      console.error('Failed to send welcome message:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendOrderConfirmation(phoneNumber, orderId, items) {
    const message = `Order Confirmation #${orderId} ✅\n\nItems:\n${items.join('\n')}\n\nThank you for your order!`;
    
    try {
      const result = await this.client.sendMessage(this.deviceId, phoneNumber, message);
      return { success: true, data: result };
    } catch (error) {
      console.error('Failed to send order confirmation:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendInvoiceWithDocument(phoneNumber, invoiceNumber, documentUrl) {
    const message = `Invoice #${invoiceNumber} 📄\n\nPlease find your invoice document attached.`;
    
    try {
      const result = await this.client.sendMessage(this.deviceId, phoneNumber, message, documentUrl);
      return { success: true, data: result };
    } catch (error) {
      console.error('Failed to send invoice:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateKirimiFeatures();
}

// Export classes for use in other modules
module.exports = {
  OTPService,
  NotificationService,
  demonstrateKirimiFeatures
}; 