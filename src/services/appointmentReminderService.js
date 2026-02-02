import twilio from 'twilio';
import Appointment from '../models/appointment.models.js';
import User from '../models/user.models.js';
import Property from '../models/property.models.js';
import dotenv from 'dotenv';
import { getTwilioSenderConfig } from '../libs/twilioSender.js';

dotenv.config();

// Configurar Twilio
let twilioClient = null;
const TWILIO_ENABLED = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here';

if (TWILIO_ENABLED) {
    try {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio configured for appointment reminders');
    } catch (error) {
        console.error('❌ Error configuring Twilio for reminders:', error.message);
    }
}

/**
 * Send appointment reminder SMS to client
 */
const sendClientReminder = async (appointment, property) => {
    if (!twilioClient || !TWILIO_ENABLED) {
        console.log(`[MOCK] Client reminder for appointment ${appointment._id}`);
        return { success: true, mode: 'mock' };
    }

    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    const message = `FR Family Investments - Appointment Reminder

Dear ${appointment.visitor.name},

This is a reminder of your scheduled property viewing:

Property: ${property.title}
Address: ${property.address?.street || 'N/A'}, ${property.address?.city || ''}
Date: ${formattedDate}
Time: ${appointment.appointmentTime}

Please arrive on time. If you need to reschedule, contact us as soon as possible.

Thank you.`;

    try {
        const result = await twilioClient.messages.create({
            body: message,
            to: appointment.visitor.phone,
            ...getTwilioSenderConfig()
        });

        console.log(`✅ Client reminder sent to ${appointment.visitor.phone} - SID: ${result.sid}`);
        return { success: true, mode: 'twilio', sid: result.sid };
    } catch (error) {
        console.error(`❌ Error sending client reminder:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Send appointment reminder SMS to assigned admin/co-admin
 */
const sendAdminReminder = async (appointment, property, admin) => {
    if (!twilioClient || !TWILIO_ENABLED) {
        console.log(`[MOCK] Admin reminder for appointment ${appointment._id}`);
        return { success: true, mode: 'mock' };
    }

    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    const message = `FR Family Investments - Appointment Reminder

Hello ${admin.username},

Reminder: You have a scheduled property viewing tomorrow.

Property: ${property.title}
Address: ${property.address?.street || 'N/A'}, ${property.address?.city || ''}
Date: ${formattedDate}
Time: ${appointment.appointmentTime}

Client: ${appointment.visitor.name}
Phone: ${appointment.visitor.phone}
Email: ${appointment.visitor.email}

Please be prepared and on time.`;

    try {
        const result = await twilioClient.messages.create({
            body: message,
            to: admin.phone,
            ...getTwilioSenderConfig()
        });

        console.log(`✅ Admin reminder sent to ${admin.phone} - SID: ${result.sid}`);
        return { success: true, mode: 'twilio', sid: result.sid };
    } catch (error) {
        console.error(`❌ Error sending admin reminder:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Check and send reminders for appointments scheduled for tomorrow
 */
export const checkAndSendReminders = async () => {
    try {
        console.log('\n🔔 ============================================');
        console.log('📅 Checking appointments for tomorrow...');

        // Calculate tomorrow's date range (00:00 to 23:59)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);

        // Find confirmed appointments for tomorrow that haven't been reminded
        const appointments = await Appointment.find({
            status: 'confirmed',
            appointmentDate: {
                $gte: tomorrow,
                $lte: tomorrowEnd
            },
            'smsNotifications.type': { $ne: 'reminder' } // No reminder sent yet
        })
        .populate('property')
        .populate('assignedTo');

        console.log(`📊 Found ${appointments.length} appointments for tomorrow`);

        if (appointments.length === 0) {
            console.log('✅ No reminders to send');
            console.log('============================================\n');
            return { success: true, sent: 0 };
        }

        let sentCount = 0;
        let failedCount = 0;

        // Send reminders
        for (const appointment of appointments) {
            console.log(`\n📤 Processing appointment ${appointment._id}...`);

            // Send to client
            const clientResult = await sendClientReminder(appointment, appointment.property);
            
            // Send to assigned admin/co-admin if exists
            let adminResult = null;
            if (appointment.assignedTo) {
                adminResult = await sendAdminReminder(appointment, appointment.property, appointment.assignedTo);
            }

            // Update appointment with reminder notification
            if (clientResult.success || adminResult?.success) {
                appointment.smsNotifications.push({
                    type: 'reminder',
                    sentAt: new Date(),
                    status: 'sent'
                });
                await appointment.save();
                sentCount++;
                console.log(`✅ Reminders sent for appointment ${appointment._id}`);
            } else {
                failedCount++;
                console.log(`❌ Failed to send reminders for appointment ${appointment._id}`);
            }
        }

        console.log('\n📊 Reminder Summary:');
        console.log(`✅ Sent: ${sentCount}`);
        console.log(`❌ Failed: ${failedCount}`);
        console.log('============================================\n');

        return {
            success: true,
            total: appointments.length,
            sent: sentCount,
            failed: failedCount
        };

    } catch (error) {
        console.error('❌ Error in reminder service:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Start cron job to check reminders daily at 9 AM
 */
export const startReminderCron = () => {
    // Check every hour if it's 9 AM
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 9 && now.getMinutes() === 0) {
            checkAndSendReminders();
        }
    }, 60000); // Check every minute

    console.log('⏰ Reminder cron job started - will run daily at 9:00 AM');
};
