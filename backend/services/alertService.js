/**
 * Alert Service
 * Simulates Email and SMS notification delivery
 * Replace simulation with real providers (e.g., Nodemailer, Twilio) in production
 */

const nodemailer = require('nodemailer');

//  Email Transporter Setup 
// In development: uses Nodemailer's Ethereal test service (console logging)
// In production: configure SMTP credentials in .env
let transporter = null;

const initTransporter = () => {
    if (process.env.NODE_ENV === 'production' && process.env.EMAIL_USER) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    } else {
        // Development: simulate email sending
        transporter = null;
    }
};

initTransporter();

/**
 * Send email alert
 * @param {Object} options - { to, subject, html, text }
 * @returns {Object} result with simulation flag
 */
const sendEmailAlert = async ({ to, subject, html, text }) => {
    const timestamp = new Date().toISOString();

    if (!transporter) {
        // SIMULATION: Log to console in development
        console.log('\n📧  EMAIL ALERT SIMULATION ');
        console.log(`   To:      ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Time:    ${timestamp}`);
        console.log(`   Message: ${text || 'HTML email (see html field)'}`);
        console.log('\n');

        return {
            simulated: true,
            messageId: `sim-${Date.now()}`,
            to,
            subject,
            timestamp,
        };
    }

    try {
        const info = await transporter.sendMail({
            from: `"Blood Emergency System" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text,
        });

        console.log(`📧 Email sent to ${to}: ${info.messageId}`);
        return { simulated: false, messageId: info.messageId, to, timestamp };
    } catch (error) {
        console.error(`❌ Email send failed: ${error.message}`);
        throw error;
    }
};

/**
 * Send SMS alert (simulated)
 * In production: replace with Twilio or AWS SNS
 * @param {string} phone - Phone number to send to
 * @param {string} message - SMS message body
 */
const sendSMSAlert = async (phone, message) => {
    const timestamp = new Date().toISOString();

    // SIMULATION: Log to console
    console.log('\n📱  SMS ALERT SIMULATION ');
    console.log(`   To:      ${phone}`);
    console.log(`   Message: ${message}`);
    console.log(`   Time:    ${timestamp}`);
    console.log('\n');

    return {
        simulated: true,
        to: phone,
        message,
        timestamp,
    };
};

/**
 * Send emergency blood request alerts to matching donors
 * @param {Array} donors - Array of donor objects
 * @param {Object} request - BloodRequest document
 */
const sendEmergencyAlerts = async (donors, request) => {
    const results = { emailsSent: 0, smsSent: 0, errors: [] };

    const urgencyLabel = {
        critical: '🚨 CRITICAL',
        urgent: '⚠️ URGENT',
        normal: 'ℹ️ NORMAL',
    };

    const subject = `${urgencyLabel[request.urgency]} Blood Request — ${request.bloodGroup} needed`;
    const messageText = `
BLOOD EMERGENCY ALERT!
Patient: ${request.patientName}
Blood Group: ${request.bloodGroup}
Units Needed: ${request.unitsRequired}
Hospital: ${request.hospital.name}, ${request.hospital.city}
Contact: ${request.contactPhone}
Urgency: ${request.urgency.toUpperCase()}

If you are available to donate, please contact the hospital immediately.
Thank you for saving lives!
  `.trim();

    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff8f8; border: 2px solid #e53e3e; border-radius: 8px; overflow: hidden;">
      <div style="background: #e53e3e; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">🩸 Blood Emergency Alert</h1>
        <p style="margin: 5px 0; font-size: 18px;">${urgencyLabel[request.urgency]} — ${request.bloodGroup} Blood Required</p>
      </div>
      <div style="padding: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">Patient:</td><td style="padding: 8px;">${request.patientName}</td></tr>
          <tr style="background: #fff0f0;"><td style="padding: 8px; font-weight: bold; color: #555;">Blood Group:</td><td style="padding: 8px; font-size: 20px; font-weight: bold; color: #e53e3e;">${request.bloodGroup}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">Units Needed:</td><td style="padding: 8px;">${request.unitsRequired}</td></tr>
          <tr style="background: #fff0f0;"><td style="padding: 8px; font-weight: bold; color: #555;">Hospital:</td><td style="padding: 8px;">${request.hospital.name}, ${request.hospital.city}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">Contact:</td><td style="padding: 8px;"><a href="tel:${request.contactPhone}">${request.contactPhone}</a></td></tr>
        </table>
        <div style="margin-top: 20px; text-align: center;">
          <a href="tel:${request.contactPhone}" style="background: #e53e3e; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold;">📞 Contact Hospital Now</a>
        </div>
      </div>
      <div style="background: #f7fafc; padding: 12px; text-align: center; color: #718096; font-size: 12px;">
        Blood Emergency Website — Saving Lives Together
      </div>
    </div>
  `;

    // Send to each matching donor
    for (const donor of donors) {
        try {
            if (donor.email) {
                await sendEmailAlert({
                    to: donor.email,
                    subject,
                    html: htmlBody,
                    text: messageText,
                });
                results.emailsSent++;
            }

            if (donor.phone) {
                const smsMessage = `BLOOD EMERGENCY: ${request.bloodGroup} needed at ${request.hospital.name}. Contact: ${request.contactPhone}. Patient: ${request.patientName}. PLEASE RESPOND!`;
                await sendSMSAlert(donor.phone, smsMessage);
                results.smsSent++;
            }
        } catch (error) {
            results.errors.push({ donor: donor._id, error: error.message });
        }
    }

    console.log(`✅ Alerts sent: ${results.emailsSent} emails, ${results.smsSent} SMS`);
    return results;
};

module.exports = { sendEmailAlert, sendSMSAlert, sendEmergencyAlerts };
