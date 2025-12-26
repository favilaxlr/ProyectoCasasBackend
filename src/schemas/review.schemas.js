import { z } from 'zod';

export const reviewSchema = z.object({
    propertyId: z.string({
        required_error: "El ID de la propiedad es requerido"
    }),
    
    appointmentId: z.string().optional(),
    
    rating: z.union([
        z.number(),
        z.string().transform((val) => parseInt(val))
    ]).refine((val) => val >= 1 && val <= 5, {
        message: "La calificación debe estar entre 1 y 5"
    }),
    
    subcategories: z.object({
        location: z.number().min(1).max(5).optional(),
        condition: z.number().min(1).max(5).optional(),
        value: z.number().min(1).max(5).optional(),
        service: z.number().min(1).max(5).optional()
    }).optional(),
    
    comment: z.string({
        required_error: "El comentario es requerido"
    }).min(10, "El comentario debe tener al menos 10 caracteres")
      .max(1000, "El comentario no puede exceder 1000 caracteres"),
    
    recommendation: z.union([
        z.boolean(),
        z.string().transform((val) => val === 'true')
    ]).optional()
});

export const moderateReviewSchema = z.object({
    action: z.enum(['approve', 'reject', 'request_changes'], {
        required_error: "La acción es requerida"
    }),
    
    moderationNotes: z.string().optional()
});