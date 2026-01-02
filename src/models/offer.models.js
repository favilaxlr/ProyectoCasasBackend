import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    }
});

const offerSchema = new mongoose.Schema(
    {
        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Property',
            required: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        offerAmount: {
            type: Number,
            required: true
        },
        messages: [messageSchema],
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'accepted', 'rejected', 'closed'],
            default: 'pending'
        },
        // Admin o Co-Admin que tomó la conversación
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        assignedAt: {
            type: Date,
            default: null
        },
        // Contador de mensajes no leídos
        unreadCount: {
            user: {
                type: Number,
                default: 0
            },
            admin: {
                type: Number,
                default: 0
            }
        }
    },
    {
        timestamps: true
    }
);

// Índices para búsquedas más eficientes
offerSchema.index({ property: 1, user: 1 });
offerSchema.index({ status: 1 });
offerSchema.index({ assignedTo: 1 });

export default mongoose.model('Offer', offerSchema);
