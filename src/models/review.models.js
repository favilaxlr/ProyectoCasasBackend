import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        // Referencia a la propiedad
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property',
            required: true
        },
        
        // Usuario que hace la reseña
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        
        // Cita asociada (para validar elegibilidad)
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            required: true
        },
        
        // Calificación principal
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        
        // Calificaciones por subcategorías (opcional)
        subcategories: {
            location: {
                type: Number,
                min: 1,
                max: 5
            },
            condition: {
                type: Number,
                min: 1,
                max: 5
            },
            value: {
                type: Number,
                min: 1,
                max: 5
            },
            service: {
                type: Number,
                min: 1,
                max: 5
            }
        },
        
        // Comentario
        comment: {
            type: String,
            required: true,
            minlength: 10,
            maxlength: 1000
        },
        
        // Imágenes de la reseña (opcional, máximo 5)
        images: [{
            url: {
                type: String,
                required: true
            },
            publicId: String,
            caption: String
        }],
        
        // Estado de moderación
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'changes_requested'],
            default: 'pending'
        },
        
        // Notas de moderación
        moderationNotes: String,
        
        // Moderado por
        moderatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        
        // Fecha de moderación
        moderatedAt: Date,
        
        // Reseña destacada
        featured: {
            type: Boolean,
            default: false
        },
        
        // Votos de utilidad
        helpfulVotes: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            votedAt: {
                type: Date,
                default: Date.now
            }
        }],
        
        // Contador de votos útiles
        helpfulCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// Índice único para evitar múltiples reseñas del mismo usuario en la misma propiedad
reviewSchema.index({ property: 1, user: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);