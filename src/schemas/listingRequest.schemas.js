import { z } from 'zod';

const PROPERTY_TYPES = ['house', 'apartment', 'condo', 'townhouse', 'vacant_land'];

const parseBoolean = (val) => val === true || val === 'true' || val === 'on';

export const listingRequestSchema = z.object({
    fullName: z.string({
        required_error: 'Full name is required'
    }).trim().min(3, 'Full name must be at least 3 characters')
        .max(80, 'Full name must be at most 80 characters'),

    phone: z.string({
        required_error: 'Phone is required'
    }).trim().min(1, 'Phone is required')
        .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in international format (+[country code][number])'),

    email: z.string({
        required_error: 'Email is required'
    }).trim().email('Invalid email')
        .max(120, 'Email is too long'),

    location: z.string({
        required_error: 'Location is required'
    }).trim().min(2, 'Enter the city or neighborhood')
        .max(120, 'Location must be at most 120 characters'),

    propertyType: z.enum(PROPERTY_TYPES, {
        required_error: 'Property type is required',
        invalid_type_error: 'Invalid property type'
    }),

    estimatedPrice: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
        z.number({ invalid_type_error: 'Estimated price must be a number' })
            .positive('Estimated price must be positive')
            .optional()
    ),

    description: z.string({
        required_error: 'Description is required'
    }).trim().min(10, 'Description must be at least 10 characters')
        .max(2000, 'Description must be at most 2000 characters'),

    aceptaPrivacidad: z.preprocess(
        parseBoolean,
        z.literal(true, {
            errorMap: () => ({ message: 'You must accept the Privacy Policy' })
        })
    )
});

export const listingRequestStatusSchema = z.object({
    status: z.enum(['pending', 'contacted', 'closed'], {
        required_error: 'Status is required',
        invalid_type_error: 'Invalid status'
    })
});
