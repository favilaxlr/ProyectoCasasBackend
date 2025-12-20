import {z} from 'zod';

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
    password: z.string('Password requerido')
        .min(6, {
            error: 'El password debe tener al menos 6 caracteres'
        })
})//Fin de registerSchema

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