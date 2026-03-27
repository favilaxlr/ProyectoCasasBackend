import { z } from 'zod';
import { 
    NOTIFICATION_CITIES,
    MAX_NOTIFICATION_CITIES,
    MIN_NOTIFICATION_CITIES
} from '../config/notificationCities.js';

const allowedCityCodes = NOTIFICATION_CITIES.map(city => city.code);

export const registerSchema = z.object({
    username: z.string('Nombre del usuario requerido')
        .min(5, 
            {
                error: 'El username debe tener al menos 5 caracteres'
            }),
        
    email: z.email({
                error: (email) => email.input === undefined ? 'El email es requerido'
                                                                :'El email es invalido'
            }),
    phone: z.string('Teléfono requerido')
        .min(1, {
            error: 'El teléfono es requerido'
        })
        .regex(/^\+[1-9]\d{1,14}$/, {
            message: 'El teléfono debe estar en formato internacional (+[código][número])'
        }),
    password: z.string('Password requerido')
        .min(6, {
            error: 'El password debe tener al menos 6 caracteres'
        }),
    notificationCity: z.string({
        required_error: 'Debes seleccionar al menos una ciudad'
    }).optional(),
    notificationCities: z.array(z.string({
        required_error: 'Debes seleccionar al menos una ciudad'
    })).optional(),
    smsConsent: z.literal(true, {
        errorMap: () => ({ message: 'You must consent to SMS notifications (Reply STOP to opt out).'})
    })
})//Fin de registerSchema
    .superRefine((data, ctx) => {
        const combined = [];

        if (Array.isArray(data.notificationCities)) {
            combined.push(...data.notificationCities);
        }
        if (data.notificationCity) {
            combined.push(data.notificationCity);
        }

        const sanitized = Array.from(new Set(combined.filter(Boolean)));

        if (sanitized.length < MIN_NOTIFICATION_CITIES) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Debes seleccionar al menos ${MIN_NOTIFICATION_CITIES} ciudad${MIN_NOTIFICATION_CITIES > 1 ? 'es' : ''}`,
                path: ['notificationCities']
            });
        }

        if (sanitized.length > MAX_NOTIFICATION_CITIES) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Solo puedes seleccionar hasta ${MAX_NOTIFICATION_CITIES} ciudades`,
                path: ['notificationCities']
            });
        }

        const invalidCodes = sanitized.filter(code => !allowedCityCodes.includes(code));
        if (invalidCodes.length > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Una o más ciudades seleccionadas no están disponibles',
                path: ['notificationCities']
            });
        }
    });

export const loginSchema = z.object({
        
    email: z.email({
                required_error: 'Email es requerido',
                invalid_type_error: 'Email es invalido'
            }),
    password: z.string({
        required_error: 'Password requerido'
    })
        .min(6, {
            message: 'El password debe tener al menos 6 caracteres'
        })
})//Fin de registerSchema