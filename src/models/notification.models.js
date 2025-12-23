import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        // Tipo de notificación
        type: {
            type: String,
            enum: ['new_property', 'general'],
            default: 'new_property'
        },
        
        // Propiedad relacionada (si aplica)
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property'
        },
        
        // Mensaje enviado
        message: {
            type: String,
            required: true
        },
        
        // Estadísticas del envío
        stats: {
            totalUsers: {
                type: Number,
                required: true
            },
            sentCount: {
                type: Number,
                default: 0
            },
            failedCount: {
                type: Number,
                default: 0
            },
            invalidNumbers: [{
                phone: String,
                error: String
            }]
        },
        
        // Estado del envío masivo
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'completed', 'failed'],
            default: 'pending'
        },
        
        // Administrador que inició el envío
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        
        // Tiempo de procesamiento
        processingTime: {
            startedAt: Date,
            completedAt: Date,
            duration: Number // en segundos
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('Notification', notificationSchema);