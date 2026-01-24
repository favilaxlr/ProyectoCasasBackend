import Appointment from '../models/appointment.models.js';
import Property from '../models/property.models.js';
import User from '../models/user.models.js';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { checkAndSendReminders } from '../services/appointmentReminderService.js';

dotenv.config();

// Función para enviar SMS a admin asignado
const notifyAssignedAdmin = async (appointment, property) => {
    if (!client || !appointment.assignedTo) return;
    
    try {
        const admin = await User.findById(appointment.assignedTo);
        if (!admin || !admin.phone) return;

        const formattedDate = new Date(appointment.appointmentDate).toLocaleDateString('en-US');
        const message = `APPOINTMENT CONFIRMED - ${appointment.visitor.name} confirmed their visit for "${property.title}" on ${formattedDate} at ${appointment.appointmentTime}. Contact: ${appointment.visitor.phone}`;
        
        await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: admin.phone
        });
        
        console.log(`📲 Notificación enviada al admin ${admin.username}`);
    } catch (error) {
        console.error('❌ Error notificando admin:', error.message);
    }
};

// Configurar Twilio solo si las credenciales están disponibles
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here') {
    try {
        client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio configurado correctamente para appointments');
        console.log('📱 Número de envío:', process.env.TWILIO_PHONE_NUMBER);
    } catch (error) {
        console.error('❌ Error configurando Twilio para citas:', error);
    }
} else {
    console.warn('⚠️ Twilio NO configurado - Credenciales faltantes');
}

// Generar código de confirmación único
const generateConfirmationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Función para enviar SMS de confirmación con link
const sendConfirmationSMS = async (phone, appointmentId, confirmationCode, propertyTitle, appointmentDate, appointmentTime) => {
    if (!client) {
        console.log('Twilio no configurado - saltando SMS de confirmación');
        return false;
    }
    
    try {
        const confirmLink = `${process.env.BASE_URL_FRONTEND}/confirm-appointment/${appointmentId}/${confirmationCode}`;
        const message = `Confirm your appointment for "${propertyTitle}" on ${appointmentDate} at ${appointmentTime}. Tap the link to confirm: ${confirmLink}`;
        
        await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
        
        console.log(`📱 SMS con link enviado a ${phone}`);
        return true;
    } catch (error) {
        console.error('Error enviando SMS:', error);
        return false;
    }
};

// Función para crear una cita (usuarios registrados)
export const createAppointment = async (req, res) => {
    try {
        const { propertyId, appointmentDate, appointmentTime, notes } = req.body;

        // Obtener información del usuario
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }

        // Verificar que la propiedad existe y está disponible
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: ['Propiedad no encontrada'] });
        }

        if (property.status !== 'DISPONIBLE') {
            return res.status(400).json({ message: ['Esta propiedad no está disponible para citas'] });
        }

        // Validar fecha y hora
        const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
        const now = new Date();
        
        if (appointmentDateTime <= now) {
            return res.status(400).json({ message: ['No puedes agendar citas en el pasado'] });
        }

        // Validar horarios laborales (Lunes-Viernes 9am-6pm, Sábados 10am-2pm)
        const dayOfWeek = appointmentDateTime.getDay();
        const hour = appointmentDateTime.getHours();
        
        if (dayOfWeek === 0) { // Domingo
            return res.status(400).json({ message: ['No hay atención los domingos'] });
        }
        
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Lunes a Viernes
            if (hour < 9 || hour >= 18) {
                return res.status(400).json({ message: ['Horario de atención: Lunes a Viernes 9:00 AM - 6:00 PM'] });
            }
        } else if (dayOfWeek === 6) { // Sábado
            if (hour < 10 || hour >= 14) {
                return res.status(400).json({ message: ['Horario de atención sábados: 10:00 AM - 2:00 PM'] });
            }
        }

        // Crear timeSlot único para validar conflictos
        const timeSlot = `${appointmentDate}-${appointmentTime}`;
        
        // Verificar conflictos de horario
        const existingAppointment = await Appointment.findOne({
            property: propertyId,
            timeSlot,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (existingAppointment) {
            return res.status(400).json({ message: ['Este horario ya está ocupado'] });
        }

        // Verificar límite de 2 citas activas por usuario
        const userActiveAppointments = await Appointment.countDocuments({
            user: req.user.id,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (userActiveAppointments >= 2) {
            return res.status(400).json({ message: ['No puedes tener más de 2 citas activas'] });
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
        
        // Intentar enviar SMS de confirmación con link (no bloqueante)
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
            // Si no se pudo enviar SMS, marcar como confirmada directamente
            savedAppointment.status = 'confirmed';
            await savedAppointment.save();
            console.log(`⚠️ SMS no enviado - Cita ${savedAppointment._id} confirmada automáticamente`);
        }
        
        const responseMessage = smsSuccess ? 
            'Cita creada. Se ha enviado un SMS de confirmación a tu teléfono.' :
            'Cita creada y confirmada exitosamente. (SMS de confirmación no disponible para tu región)';
        
        res.json({
            message: responseMessage,
            appointment: savedAppointment,
            confirmationRequired: smsSuccess,
            smsNotification: smsSuccess
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ message: ['Error al crear la cita'] });
    }
};

// Función para obtener todas las citas (admin)
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
        res.status(500).json({ message: ['Error al obtener las citas'] });
    }
};

// Función para obtener una cita por ID
export const getAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('property');
        
        if (!appointment) {
            return res.status(404)
                .json({ message: ['Cita no encontrada'] });
        }
        
        res.json(appointment);
    } catch (error) {
        res.status(500)
            .json({ message: ['Error al obtener la cita'] });
    }
};

// Webhook de Twilio para recibir respuestas SMS automáticamente
export const twilioWebhook = async (req, res) => {
    try {
        // Twilio envía datos como application/x-www-form-urlencoded
        const { Body, From } = req.body;
        
        console.log('\n📱 ============================================');
        console.log('🔔 SMS recibido de Twilio');
        console.log(`📞 De: ${From}`);
        console.log(`💬 Mensaje: ${Body}`);
        console.log('📱 ============================================\n');
        
        if (!Body || !From) {
            console.log('❌ Datos incompletos del webhook');
            return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        }

        // Buscar cita pendiente de este número de teléfono
        const appointment = await Appointment.findOne({ 
            'visitor.phone': From,
            status: 'pending_sms_confirmation'
        }).populate('property', 'title').populate('assignedTo', 'username phone');
        
        if (!appointment) {
            console.log('⚠️ No se encontró cita pendiente para este número');
            return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        }

        const responseText = Body.toLowerCase().trim();
        
        // Verificar si la respuesta es "YES"
        if (responseText === 'yes' || responseText === 'si' || responseText === 'sí') {
            appointment.status = 'confirmed';
            appointment.confirmedAt = new Date();
            await appointment.save();
            
            console.log(`✅ Cita ${appointment._id} confirmada por SMS`);
            
            // Notificar al admin asignado
            await notifyAssignedAdmin(appointment, appointment.property);
            
            // Responder al usuario
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Thank you! Your appointment for "${appointment.property.title}" is confirmed. We look forward to seeing you on ${new Date(appointment.appointmentDate).toLocaleDateString('en-US')} at ${appointment.appointmentTime}.</Message>
</Response>`;
            
            return res.status(200).type('text/xml').send(twimlResponse);
        } else if (responseText === 'no') {
            appointment.status = 'cancelled';
            appointment.notes = (appointment.notes || '') + '\nCancelada por SMS: Usuario respondió NO';
            await appointment.save();
            
            console.log(`❌ Cita ${appointment._id} cancelada por SMS`);
            
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Understood. Your appointment has been cancelled. You can schedule a new visit at any time.</Message>
</Response>`;
            
            return res.status(200).type('text/xml').send(twimlResponse);
        } else {
            // Respuesta no reconocida
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Please use the link we sent to confirm your appointment. If you need to cancel, you can manage it from your account.</Message>
</Response>`;
            
            return res.status(200).type('text/xml').send(twimlResponse);
        }
    } catch (error) {
        console.error('❌ Error en webhook de Twilio:', error);
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
};

// Función para confirmar cita por SMS (endpoint manual - mantener por compatibilidad)
export const confirmAppointmentBySMS = async (req, res) => {
    try {
        const { confirmationCode, response } = req.body;
        
        if (!confirmationCode || !response) {
            return res.status(400).json({ message: ['Código de confirmación y respuesta son requeridos'] });
        }

        const appointment = await Appointment.findOne({ 
            confirmationCode,
            status: 'pending_sms_confirmation'
        }).populate('property', 'title');
        
        if (!appointment) {
            return res.status(404).json({ message: ['Cita no encontrada o ya procesada'] });
        }

        // Verificar si la respuesta es "YES" (case insensitive)
        if (response.toLowerCase().trim() === 'yes') {
            appointment.status = 'confirmed';
            appointment.confirmedAt = new Date();
            await appointment.save();
            
            // Notificar al admin asignado
            await notifyAssignedAdmin(appointment, appointment.property);
            
            res.json({ 
                message: 'Cita confirmada exitosamente',
                appointment,
                confirmed: true
            });
        } else {
            appointment.status = 'cancelled';
            appointment.notes = (appointment.notes || '') + '\nCancelada por SMS: Respuesta negativa';
            await appointment.save();
            
            res.json({ 
                message: 'Cita cancelada',
                appointment,
                confirmed: false
            });
        }
    } catch (error) {
        console.error('Error confirming appointment by SMS:', error);
        res.status(500).json({ message: ['Error al procesar confirmación por SMS'] });
    }
};

// Función para confirmar cita por link (pública)
export const confirmAppointmentByLink = async (req, res) => {
    try {
        const { id, code } = req.params;
        
        if (!id || !code) {
            return res.status(400).json({ message: ['Parámetros inválidos'] });
        }

        const appointment = await Appointment.findOne({ 
            _id: id,
            confirmationCode: code,
            status: 'pending_sms_confirmation'
        }).populate('property', 'title address');
        
        if (!appointment) {
            return res.status(404).json({ 
                message: ['Cita no encontrada o ya fue procesada'],
                alreadyConfirmed: false
            });
        }

        // Confirmar la cita
        appointment.status = 'confirmed';
        appointment.confirmedAt = new Date();
        await appointment.save();
        
        console.log(`✅ Cita ${appointment._id} confirmada por link`);
        
        res.json({ 
            success: true,
            message: '¡Cita confirmada exitosamente!',
            appointment: {
                property: appointment.property.title,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime,
                address: appointment.property.address
            }
        });
    } catch (error) {
        console.error('Error confirmando cita por link:', error);
        res.status(500).json({ message: ['Error al confirmar la cita'] });
    }
};

// Función para asignar cita a admin/co-admin
export const assignAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        
        const appointment = await Appointment.findById(id)
            .populate('property', 'title address');
            
        if (!appointment) {
            return res.status(404).json({ message: ['Cita no encontrada'] });
        }

        // Solo citas confirmadas pueden ser asignadas
        if (appointment.status !== 'confirmed') {
            return res.status(400).json({ message: ['Solo puedes asignarte citas confirmadas'] });
        }

        // Asignar al admin actual
        appointment.assignedTo = adminId;
        await appointment.save();
        
        // Obtener información del admin
        const admin = await User.findById(adminId).select('username phone');
        
        // Enviar SMS de confirmación al cliente
        if (client && appointment.visitor && appointment.visitor.phone) {
            try {
                const fechaCita = new Date(appointment.appointmentDate).toLocaleDateString('en-US');

                const direccion = appointment.property.address 
                    ? `${appointment.property.address.street}, ${appointment.property.address.city}`
                    : 'To be confirmed';

                const message = `FR Family Investments - Your appointment for "${appointment.property.title}" is confirmed. Date: ${fechaCita} at ${appointment.appointmentTime}. Agent: ${admin.username}. Address: ${direccion}`;
                
                console.log('📤 Intentando enviar SMS...');
                console.log('📱 Destino:', appointment.visitor.phone);
                console.log('📝 Mensaje:', message);
                
                const result = await client.messages.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: appointment.visitor.phone
                });
                
                console.log(`✅ SMS enviado exitosamente - SID: ${result.sid}`);
                console.log(`📊 Estado: ${result.status}`);
            } catch (error) {
                console.error('❌ Error enviando SMS de confirmación final:', error.message);
                console.error('📋 Detalles:', error);
            }
        } else {
            console.log('⚠️ No se pudo enviar SMS: Twilio no configurado o teléfono faltante');
        }
        
        console.log(`✅ Cita ${id} asignada a ${admin.username}`);
        
        res.json({ 
            message: 'Cita asignada exitosamente. Se ha notificado al cliente.',
            appointment
        });
    } catch (error) {
        console.error('❌ Error asignando cita:', error);
        res.status(500).json({ message: ['Error al asignar la cita'] });
    }
};

// Función para confirmar una cita (admin)
export const confirmAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: ['Cita no encontrada'] });
        }

        appointment.status = 'confirmed';
        appointment.confirmedAt = new Date();
        await appointment.save();

        res.json({ message: 'Cita confirmada exitosamente', appointment });
    } catch (error) {
        res.status(500).json({ message: ['Error al confirmar la cita'] });
    }
};

// Función para completar una cita (admin)
export const completeAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: ['Cita no encontrada'] });
        }

        appointment.status = 'completed';
        await appointment.save();

        res.json({ message: 'Cita marcada como completada', appointment });
    } catch (error) {
        res.status(500).json({ message: ['Error al completar la cita'] });
    }
};

// Función para cancelar una cita
export const cancelAppointment = async (req, res) => {
    try {
        const { reason } = req.body;
        
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: ['Cita no encontrada'] });
        }

        appointment.status = 'cancelled';
        if (reason) {
            appointment.notes = (appointment.notes || '') + `\nCancelada: ${reason}`;
        }
        await appointment.save();

        res.json({ message: 'Cita cancelada', appointment });
    } catch (error) {
        res.status(500).json({ message: ['Error al cancelar la cita'] });
    }
};

// Función para obtener horarios disponibles
export const getAvailableSlots = async (req, res) => {
    try {
        const { propertyId, date } = req.query;
        
        if (!propertyId || !date) {
            return res.status(400).json({ message: ['PropertyId y date son requeridos'] });
        }

        // Generar horarios disponibles (bloques de 30 min)
        const slots = [];
        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay();
        
        let startHour, endHour;
        
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Lunes a Viernes
            startHour = 9;
            endHour = 18;
        } else if (dayOfWeek === 6) { // Sábado
            startHour = 10;
            endHour = 14;
        } else { // Domingo
            return res.json({ availableSlots: [] });
        }
        
        // Generar slots de 30 minutos
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute of [0, 30]) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const timeSlot = `${date}-${timeString}`;
                
                // Verificar si el slot está ocupado
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
        res.status(500).json({ message: ['Error al obtener horarios disponibles'] });
    }
};

// Función para obtener citas del usuario
export const getUserAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ user: req.user.id })
            .populate('property', 'title address images')
            .sort({ appointmentDate: -1 });
        
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: ['Error al obtener citas del usuario'] });
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