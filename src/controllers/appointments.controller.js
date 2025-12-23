import Appointment from '../models/appointment.models.js';
import Property from '../models/property.models.js';
import User from '../models/user.models.js';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Configurar Twilio solo si las credenciales están disponibles
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here') {
    try {
        client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } catch (error) {
        console.error('Error configurando Twilio para citas:', error);
    }
}

// Generar código de confirmación único
const generateConfirmationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Función para enviar SMS de confirmación
const sendConfirmationSMS = async (phone, confirmationCode, propertyTitle, appointmentDate, appointmentTime) => {
    if (!client) {
        console.log('Twilio no configurado - saltando SMS de confirmación');
        return false;
    }
    
    try {
        const message = `Confirma tu cita para "${propertyTitle}" el ${appointmentDate} a las ${appointmentTime}. Responde "YES" para confirmar. Código: ${confirmationCode}`;
        
        await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
        
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
        
        // Enviar SMS de confirmación
        const smsSuccess = await sendConfirmationSMS(
            user.phone,
            confirmationCode,
            property.title,
            appointmentDate,
            appointmentTime
        );

        if (!smsSuccess && client) {
            // Si falla el SMS y Twilio está configurado, eliminar la cita
            await Appointment.findByIdAndDelete(savedAppointment._id);
            return res.status(500).json({ message: ['Error al enviar SMS de confirmación'] });
        }
        
        const responseMessage = client ? 
            'Cita creada. Se ha enviado un SMS de confirmación a tu teléfono.' :
            'Cita creada exitosamente. (SMS deshabilitado - Twilio no configurado)';
        
        res.json({
            message: responseMessage,
            appointment: savedAppointment,
            confirmationRequired: !!client
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

// Función para confirmar cita por SMS
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