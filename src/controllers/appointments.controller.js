import Appointment from '../models/appointment.models.js';
import Property from '../models/property.models.js';
import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { checkAndSendReminders } from '../services/appointmentReminderService.js';
import { getTwilioSenderConfig } from '../libs/twilioSender.js';
import { buildSMS, shorten, formatShortDate, formatTimeLabel } from '../libs/smsTemplates.js';

dotenv.config();

// Notify assigned admin via SMS
const notifyAssignedAdmin = async (appointment, property) => {
    if (!client || !appointment.assignedTo) return;
    
    try {
        const admin = await User.findById(appointment.assignedTo);
        if (!admin || !admin.phone) return;

        const dateLabel = formatShortDate(appointment.appointmentDate);
        const timeLabel = formatTimeLabel(appointment.appointmentTime);
        const title = shorten(property.title, 24);
        const visitorName = shorten(appointment.visitor?.name || 'Client', 16);
        const payload = `Client confirmed ${title} ${dateLabel} ${timeLabel} ${visitorName}`;
        const message = buildSMS(payload);
        
        await client.messages.create({
            body: message,
            to: admin.phone,
            ...getTwilioSenderConfig()
        });
        
        console.log(`📲 Notification sent to admin ${admin.username}`);
    } catch (error) {
        console.error('❌ Error notifying admin:', error.message);
    }
};

// Configure Twilio only when credentials exist
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here') {
    try {
        client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio configured correctly for appointments');
        console.log('📱 Sending number:', process.env.TWILIO_PHONE_NUMBER);
    } catch (error) {
        console.error('❌ Error configuring Twilio for appointments:', error);
    }
} else {
    console.warn('⚠️ Twilio NOT configured - missing credentials');
}

const notifyAdminsOfNewAppointment = async (appointment, property, visitor) => {
    if (!client) {
        console.log('Twilio not configured - skipping admin notifications');
        return;
    }

    try {
        const adminRoles = await Role.find({ role: { $in: ['admin', 'co-admin'] } }).select('_id role');
        if (!adminRoles.length) {
            console.log('No admin or co-admin roles found for SMS notifications');
            return;
        }

        const adminRoleIds = adminRoles.map(role => role._id);
        const recipients = await User.find({
            role: { $in: adminRoleIds },
            phone: { $exists: true, $ne: '' }
        }).select('username phone');

        if (!recipients.length) {
            console.log('No admin recipients available for appointment notification');
            return;
        }

        const visitorName = visitor?.username || appointment.visitor?.name || 'A client';

        const dateLabel = formatShortDate(appointment.appointmentDate);
        const timeLabel = formatTimeLabel(appointment.appointmentTime);
        const title = shorten(property.title, 24);
        const payload = `New appt ${title} ${dateLabel} ${timeLabel} client ${shorten(visitorName, 16)}`;
        const smsBody = buildSMS(payload);

        await Promise.all(
            recipients.map(async recipient => {
                try {
                    await client.messages.create({
                        body: smsBody,
                        to: recipient.phone,
                        ...getTwilioSenderConfig()
                    });
                    console.log(`📲 Admin notification sent to ${recipient.username}`);
                } catch (smsError) {
                    console.error(`❌ Error sending admin notification to ${recipient.username}:`, smsError.message);
                }
            })
        );
    } catch (error) {
        console.error('❌ Error notifying admins about new appointment:', error.message);
    }
};

// Generar código de confirmación único
const generateConfirmationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Send confirmation SMS with link
const sendConfirmationSMS = async (phone, appointmentId, confirmationCode, propertyTitle, appointmentDate, appointmentTime) => {
    if (!client) {
        console.log('Twilio not configured - skipping confirmation SMS');
        return false;
    }
    
    try {
        const title = shorten(propertyTitle, 28);
        const dateLabel = formatShortDate(appointmentDate);
        const timeLabel = formatTimeLabel(appointmentTime);
        const payload = `Please confirm ${title} on ${dateLabel} at ${timeLabel}. Reply YES.`;
        const message = buildSMS(payload);
        
        await client.messages.create({
            body: message,
            to: phone,
            ...getTwilioSenderConfig()
        });
        
        console.log(`📱 Confirmation SMS sent to ${phone}`);
        return true;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
};

// Función para crear una cita (usuarios registrados)
export const createAppointment = async (req, res) => {
    try {
        const { propertyId, appointmentDate, appointmentTime, notes } = req.body;

        // Get user information
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: ['User not found'] });
        }

        // Verify the property exists and is available
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: ['Property not found'] });
        }

        if (property.status !== 'DISPONIBLE') {
            return res.status(400).json({ message: ['This property is not available for appointments'] });
        }

        // Validate appointment date and time
        const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
        const now = new Date();
        
        if (appointmentDateTime <= now) {
            return res.status(400).json({ message: ['You cannot schedule appointments in the past'] });
        }

        // Validate business hours (Mon-Fri 9am-6pm, Sat 10am-2pm)
        const dayOfWeek = appointmentDateTime.getDay();
        const hour = appointmentDateTime.getHours();
        
        if (dayOfWeek === 0) { // Sunday
            return res.status(400).json({ message: ['Appointments are unavailable on Sundays'] });
        }
        
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
            if (hour < 9 || hour >= 18) {
                return res.status(400).json({ message: ['Business hours: Monday to Friday 9:00 AM - 6:00 PM'] });
            }
        } else if (dayOfWeek === 6) { // Saturday
            if (hour < 10 || hour >= 14) {
                return res.status(400).json({ message: ['Saturday availability: 10:00 AM - 2:00 PM'] });
            }
        }

        // Crear timeSlot único para validar conflictos
        const timeSlot = `${appointmentDate}-${appointmentTime}`;
        
        // Check for conflicts
        const existingAppointment = await Appointment.findOne({
            property: propertyId,
            timeSlot,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (existingAppointment) {
            return res.status(400).json({ message: ['This time slot is already booked'] });
        }

        // Enforce limit of 2 active appointments per user
        const userActiveAppointments = await Appointment.countDocuments({
            user: req.user.id,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (userActiveAppointments >= 2) {
            return res.status(400).json({ message: ['You cannot have more than 2 active appointments'] });
        }

        // Generar código de confirmación
        const confirmationCode = generateConfirmationCode();

        const newAppointment = new Appointment({
            property: propertyId,
            user: req.user.id,
            visitor: {
                name: user.username,
                phone: user.phone,
                email: user.email
            },
            appointmentDate: appointmentDateTime,
            appointmentTime,
            timeSlot,
            confirmationCode,
            notes,
            status: 'pending_sms_confirmation'
        });

        const savedAppointment = await newAppointment.save();
        
        // Try to send confirmation SMS with link (non-blocking)
        const smsSuccess = await sendConfirmationSMS(
            user.phone,
            savedAppointment._id,
            confirmationCode,
            property.title,
            appointmentDate,
            appointmentTime
        );

        // Actualizar estado según si se pudo enviar SMS
        if (!smsSuccess) {
            // Auto-confirm if SMS failed
            savedAppointment.status = 'confirmed';
            await savedAppointment.save();
            console.log(`⚠️ SMS could not be sent - appointment ${savedAppointment._id} auto-confirmed`);
        }
        
        const responseMessage = smsSuccess ? 
            'Appointment created. A confirmation SMS was sent to your phone.' :
            'Appointment created and auto-confirmed. (Confirmation SMS unavailable for your region)';
        
        await notifyAdminsOfNewAppointment(savedAppointment, property, user);

        res.json({
            message: responseMessage,
            appointment: savedAppointment,
            confirmationRequired: smsSuccess,
            smsNotification: smsSuccess
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ message: ['Error creating the appointment'] });
    }
};

// Get all appointments (admin)
export const getAppointments = async (req, res) => {
    try {
        const { startDate, endDate, propertyId, status } = req.query;
        
        let filter = {};
        
        if (startDate && endDate) {
            filter.appointmentDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (propertyId) {
            filter.property = propertyId;
        }
        
        if (status) {
            filter.status = status;
        }

        const appointments = await Appointment.find(filter)
            .populate('property', 'title address')
            .populate('user', 'username email')
            .populate('assignedTo', 'username')
            .sort({ appointmentDate: 1 });
        
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: ['Error retrieving appointments'] });
    }
};

    // Get appointment by ID
export const getAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('property');
        
        if (!appointment) {
            return res.status(404)
                .json({ message: ['Appointment not found'] });
        }
        
        res.json(appointment);
    } catch (error) {
        res.status(500)
            .json({ message: ['Error retrieving the appointment'] });
    }
};

// Twilio webhook to process inbound SMS replies
export const twilioWebhook = async (req, res) => {
    try {
        // Twilio sends data as application/x-www-form-urlencoded
        const { Body, From } = req.body;
        
        console.log('\n📱 ============================================');
        console.log('🔔 SMS received from Twilio');
        console.log(`📞 From: ${From}`);
        console.log(`💬 Message: ${Body}`);
        console.log('📱 ============================================\n');
        
        if (!Body || !From) {
            console.log('❌ Webhook missing body or sender');
            return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        }

        // Look for a pending appointment tied to this phone number
        const appointment = await Appointment.findOne({ 
            'visitor.phone': From,
            status: 'pending_sms_confirmation'
        }).populate('property', 'title').populate('assignedTo', 'username phone');
        
        if (!appointment) {
            console.log('⚠️ No pending appointment for this number');
            return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        }

        const responseText = Body.toLowerCase().trim();
        
        // Handle YES responses
        if (responseText === 'yes' || responseText === 'si' || responseText === 'sí') {
            appointment.status = 'confirmed';
            appointment.confirmedAt = new Date();
            await appointment.save();
            
            console.log(`✅ Appointment ${appointment._id} confirmed via SMS`);
            
            // Notify assigned admin
            await notifyAssignedAdmin(appointment, appointment.property);
            
            // Responder al usuario
            const dateLabel = formatShortDate(appointment.appointmentDate);
            const timeLabel = formatTimeLabel(appointment.appointmentTime);
            const title = shorten(appointment.property.title, 28);
            const confirmReply = buildSMS(`Appointment confirmed for ${title} ${dateLabel} ${timeLabel}`);
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${confirmReply}</Message>
</Response>`;
            
            return res.status(200).type('text/xml').send(twimlResponse);
        } else if (responseText === 'no') {
            appointment.status = 'cancelled';
            appointment.notes = (appointment.notes || '') + '\nCancelled via SMS: User replied NO';
            await appointment.save();
            
            console.log(`❌ Appointment ${appointment._id} cancelled via SMS`);
            
            const cancelReply = buildSMS('Appointment cancelled. Schedule a new visit anytime.');
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${cancelReply}</Message>
</Response>`;
            
            return res.status(200).type('text/xml').send(twimlResponse);
        } else {
            // Respuesta no reconocida
            const helpReply = buildSMS('Reply YES to confirm or NO to cancel.');
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${helpReply}</Message>
</Response>`;
            
            return res.status(200).type('text/xml').send(twimlResponse);
        }
    } catch (error) {
        console.error('❌ Error in Twilio webhook:', error);
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
};

// Manual SMS confirmation endpoint (legacy support)
export const confirmAppointmentBySMS = async (req, res) => {
    try {
        const { confirmationCode, response } = req.body;
        
        if (!confirmationCode || !response) {
            return res.status(400).json({ message: ['Confirmation code and response are required'] });
        }

        const appointment = await Appointment.findOne({ 
            confirmationCode,
            status: 'pending_sms_confirmation'
        }).populate('property', 'title');
        
        if (!appointment) {
            return res.status(404).json({ message: ['Appointment not found or already processed'] });
        }

        // Accept "YES" (case insensitive)
        if (response.toLowerCase().trim() === 'yes') {
            appointment.status = 'confirmed';
            appointment.confirmedAt = new Date();
            await appointment.save();
            
            // Notify assigned admin
            await notifyAssignedAdmin(appointment, appointment.property);
            
            res.json({ 
                message: 'Appointment confirmed successfully',
                appointment,
                confirmed: true
            });
        } else {
            appointment.status = 'cancelled';
            appointment.notes = (appointment.notes || '') + '\nCancelled via SMS: Negative response';
            await appointment.save();
            
            res.json({ 
                message: 'Appointment cancelled',
                appointment,
                confirmed: false
            });
        }
    } catch (error) {
        console.error('Error confirming appointment by SMS:', error);
        res.status(500).json({ message: ['Error processing SMS confirmation'] });
    }
};

// Public confirmation via link
export const confirmAppointmentByLink = async (req, res) => {
    try {
        const { id, code } = req.params;
        
        if (!id || !code) {
            return res.status(400).json({ message: ['Invalid parameters'] });
        }

        const appointment = await Appointment.findOne({ 
            _id: id,
            confirmationCode: code,
            status: 'pending_sms_confirmation'
        }).populate('property', 'title address');
        
        if (!appointment) {
            return res.status(404).json({ 
                message: ['Appointment not found or already processed'],
                alreadyConfirmed: false
            });
        }

        // Confirm the appointment
        appointment.status = 'confirmed';
        appointment.confirmedAt = new Date();
        await appointment.save();
        
        console.log(`✅ Appointment ${appointment._id} confirmed via link`);
        
        res.json({ 
            success: true,
            message: 'Appointment confirmed successfully!',
            appointment: {
                property: appointment.property.title,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime,
                address: appointment.property.address
            }
        });
    } catch (error) {
        console.error('Error confirming appointment via link:', error);
        res.status(500).json({ message: ['Error confirming the appointment'] });
    }
};

// Assign appointment to admin/co-admin
export const assignAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        
        const appointment = await Appointment.findById(id)
            .populate('property', 'title address');
            
        if (!appointment) {
            return res.status(404).json({ message: ['Appointment not found'] });
        }

        // Only confirmed appointments can be assigned
        if (appointment.status !== 'confirmed') {
            return res.status(400).json({ message: ['Only confirmed appointments can be assigned'] });
        }

        // Assign to current admin
        appointment.assignedTo = adminId;
        await appointment.save();
        
        // Fetch admin contact info
        const admin = await User.findById(adminId).select('username phone');
        
        // Send confirmation SMS to the client
        if (client && appointment.visitor && appointment.visitor.phone) {
            try {
                const dateLabel = formatShortDate(appointment.appointmentDate);
                const timeLabel = formatTimeLabel(appointment.appointmentTime);
                const title = shorten(appointment.property.title, 28);
                const agentName = shorten(admin.username, 14);
                const city = shorten(appointment.property.address?.city || '', 12);
                const payloadParts = ['Your visit for', title, 'is set', dateLabel, timeLabel, `agent ${agentName}`];
                if (city) payloadParts.push(city);
                const message = buildSMS(payloadParts.join(' '));
                
                console.log('📤 Attempting to send SMS...');
                console.log('📱 Destination:', appointment.visitor.phone);
                console.log('📝 Message:', message);
                
                const result = await client.messages.create({
                    body: message,
                    to: appointment.visitor.phone,
                    ...getTwilioSenderConfig()
                });
                
                console.log(`✅ SMS enviado exitosamente - SID: ${result.sid}`);
                console.log(`📊 Estado: ${result.status}`);
            } catch (error) {
                console.error('❌ Error sending final confirmation SMS:', error.message);
                console.error('📋 Details:', error);
            }
        } else {
            console.log('⚠️ No SMS sent: Twilio not configured or phone missing');
        }
        
        console.log(`✅ Appointment ${id} assigned to ${admin.username}`);
        
        res.json({ 
            message: 'Appointment assigned successfully. The client was notified.',
            appointment
        });
    } catch (error) {
        console.error('❌ Error assigning appointment:', error);
        res.status(500).json({ message: ['Error assigning the appointment'] });
    }
};

// Confirm appointment (admin)
export const confirmAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: ['Appointment not found'] });
        }

        appointment.status = 'confirmed';
        appointment.confirmedAt = new Date();
        await appointment.save();

        res.json({ message: 'Appointment confirmed successfully', appointment });
    } catch (error) {
        res.status(500).json({ message: ['Error confirming the appointment'] });
    }
};

// Complete appointment (admin)
export const completeAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: ['Appointment not found'] });
        }

        appointment.status = 'completed';
        await appointment.save();

        res.json({ message: 'Appointment marked as completed', appointment });
    } catch (error) {
        res.status(500).json({ message: ['Error completing the appointment'] });
    }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
    try {
        const { reason } = req.body;
        
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: ['Appointment not found'] });
        }

        appointment.status = 'cancelled';
        if (reason) {
            appointment.notes = (appointment.notes || '') + `\nCancelled: ${reason}`;
        }
        await appointment.save();

        res.json({ message: 'Appointment cancelled', appointment });
    } catch (error) {
        res.status(500).json({ message: ['Error cancelling the appointment'] });
    }
};

// Retrieve available slots for a property/date
export const getAvailableSlots = async (req, res) => {
    try {
        const { propertyId, date } = req.query;
        if (!propertyId || !date) {
            return res.status(400).json({ message: ['propertyId and date are required'] });
        }

        const slots = [];
        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay();
        
        let startHour;
        let endHour;
        
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday-Friday
            startHour = 9;
            endHour = 18;
        } else if (dayOfWeek === 6) { // Saturday
            startHour = 10;
            endHour = 14;
        } else { // Sunday
            return res.json({ availableSlots: [] });
        }
        
        for (let hour = startHour; hour < endHour; hour++) {
            for (const minute of [0, 30]) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const timeSlot = `${date}-${timeString}`;
                
                const existingAppointment = await Appointment.findOne({
                    property: propertyId,
                    timeSlot,
                    status: { $in: ['pending', 'confirmed'] }
                });
                
                if (!existingAppointment) {
                    slots.push({
                        time: timeString,
                        available: true
                    });
                }
            }
        }
        
        res.json({ availableSlots: slots });
    } catch (error) {
        res.status(500).json({ message: ['Error retrieving available slots'] });
    }
};

// Fetch appointments for the authenticated user
export const getUserAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ user: req.user.id })
            .populate('property', 'title address images')
            .sort({ appointmentDate: -1 });
        
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: ['Error retrieving user appointments'] });
    }
};

// Función para enviar recordatorios de citas (ejecutar diariamente)
export const sendAppointmentReminders = async (req, res) => {
    try {
        console.log('📅 Manual reminder check triggered by admin...');
        const result = await checkAndSendReminders();
        
        res.json({
            success: result.success,
            total: result.total || 0,
            sent: result.sent || 0,
            failed: result.failed || 0,
            message: result.success 
                ? `Reminders processed: ${result.sent} sent, ${result.failed} failed`
                : 'Error processing reminders'
        });
    } catch (error) {
        console.error('Error in manual reminder trigger:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error processing reminders',
            error: error.message 
        });
    }
};

// Función para borrar TODAS las citas (solo para admin - útil para limpiar base de datos)
export const deleteAllAppointments = async (req, res) => {
    try {
        console.log('🗑️  Admin requesting to delete all appointments...');
        
        const result = await Appointment.deleteMany({});
        
        console.log(`✅ Deleted ${result.deletedCount} appointments`);
        
        res.json({
            success: true,
            deletedCount: result.deletedCount,
            message: `Successfully deleted ${result.deletedCount} appointments`
        });
    } catch (error) {
        console.error('❌ Error deleting appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting appointments',
            error: error.message
        });
    }
};