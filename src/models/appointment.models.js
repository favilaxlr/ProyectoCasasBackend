import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
    {
        // Referencia a la propiedad
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property',
            required: true
        },
        
        // Datos del visitante
        visitor: {
            name: {
                type: String,
                required: true
            },
            phone: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true
            }
        },
        
        // Fecha y hora de la cita
        appointmentDate: {
            type: Date,
            required: true
        },
        appointmentTime: {
            type: String,
            required: true
        },
        
        // Validación de disponibilidad
        timeSlot: {
            type: String,
            required: true // Formato: "YYYY-MM-DD-HH:MM"
        },
        
        // Estado de la cita
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending"
        },
        
        // Código único para confirmar por SMS
        confirmationCode: {
            type: String,
            unique: true
        },
        
        // Historial de SMS enviados
        smsNotifications: [{
            type: {
                type: String,
                enum: ["initial", "confirmation", "reminder"]
            },
            sentAt: Date,
            status: {
                type: String,
                enum: ["sent", "delivered", "failed"]
            }
        }],
        
        // Notas adicionales
        notes: String,
        
        // Usuario que agenda (para usuarios registrados)
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('Appointment', appointmentSchema);