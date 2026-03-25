// Send a welcome SMS after successful verification
import twilio from 'twilio';
import { getTwilioSenderConfig } from '../libs/twilioSender.js';
import { buildSMS } from '../libs/smsTemplates.js';
import dotenv from 'dotenv';

dotenv.config();

let twilioClient = null;
const TWILIO_ENABLED = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here';
if (TWILIO_ENABLED) {
    try {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } catch (error) {
        console.error('❌ Error configuring Twilio for welcome SMS:', error.message);
    }
}

export const sendWelcomeSMS = async (phone) => {
    const welcomeMsg = 'FR Family Investments: Welcome! You are now subscribed to SMS notifications. Msg freq varies; msg & data rates may apply. Reply STOP to opt out, HELP for help.';
    try {
        if (twilioClient && TWILIO_ENABLED) {
            const smsBody = buildSMS(welcomeMsg);
            await twilioClient.messages.create({
                body: smsBody,
                to: phone,
                ...getTwilioSenderConfig()
            });
            console.log(`✅ Welcome SMS sent to ${phone}`);
            return { success: true, mode: 'twilio' };
        } else {
            // Mock mode
            console.log(`📱 [MOCK] Welcome SMS sent to ${phone}`);
            return { success: true, mode: 'mock' };
        }
    } catch (error) {
        console.error('❌ Error sending welcome SMS:', error.message);
        return { success: false, error: error.message };
    }
};
