import mongoose from 'mongoose';

const listingRequestSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            maxlength: 20
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 120
        },
        location: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        propertyType: {
            type: String,
            enum: ['house', 'apartment', 'condo', 'townhouse', 'vacant_land'],
            required: true
        },
        estimatedPrice: {
            type: Number
        },
        description: {
            type: String,
            required: true,
            maxlength: 2000
        },
        images: [{
            url: {
                type: String,
                required: true
            },
            publicId: String
        }],
        status: {
            type: String,
            enum: ['pending', 'contacted', 'closed'],
            default: 'pending'
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        aceptaPrivacidad: {
            type: Boolean,
            required: true
        }
    },
    {
        timestamps: true
    }
);

listingRequestSchema.index({ status: 1, createdAt: -1 });
listingRequestSchema.index({ email: 1 });

export default mongoose.model('ListingRequest', listingRequestSchema);
