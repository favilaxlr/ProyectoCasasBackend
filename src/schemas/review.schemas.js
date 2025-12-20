import { z } from 'zod';

export const reviewSchema = z.object({
    propertyId: z.string({
        required_error: "El ID de la propiedad es requerido"
    }),
    
    appointmentId: z.string({
        required_error: "El ID de la cita es requerido"
    }),
    
    rating: z.number({
        required_error: "La calificación es requerida"
    }).min(1, "La calificación mínima es 1").max(5, "La calificación máxima es 5"),
    
    subcategories: z.object({
        location: z.number().min(1).max(5).optional(),
        condition: z.number().min(1).max(5).optional(),
        value: z.number().min(1).max(5).optional(),
        service: z.number().min(1).max(5).optional()
    }).optional(),
    
    comment: z.string({
        required_error: "El comentario es requerido"
    }).min(50, "El comentario debe tener al menos 50 caracteres")
      .max(1000, "El comentario no puede exceder 1000 caracteres"),
    
    recommendation: z.boolean().optional()
});

export const moderateReviewSchema = z.object({
    action: z.enum(['approve', 'reject', 'request_changes'], {
        required_error: "La acción es requerida"
    }),
    
    moderationNotes: z.string().optional()
});