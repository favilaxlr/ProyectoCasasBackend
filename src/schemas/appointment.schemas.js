import { z } from 'zod';

export const appointmentSchema = z.object({
    propertyId: z.string({
        required_error: "El ID de la propiedad es requerido"
    }),
    
    appointmentDate: z.string({
        required_error: "La fecha de la cita es requerida"
    }),
    
    appointmentTime: z.string({
        required_error: "La hora de la cita es requerida"
    }),
    
    notes: z.string().optional()
});

export const cancelAppointmentSchema = z.object({
    reason: z.string().optional()
});

export const confirmAppointmentSchema = z.object({
    status: z.enum(['CONFIRMADA', 'CANCELADA', 'COMPLETADA']).optional(),
    notes: z.string().optional()
});