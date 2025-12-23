import { z } from 'zod';

export const propertySchema = z.object({
    title: z.string({
        required_error: "El título es requerido"
    }).min(1, "El título no puede estar vacío"),
    
    description: z.string({
        required_error: "La descripción es requerida"
    }).min(10, "La descripción debe tener al menos 10 caracteres"),
    
    address: z.object({
        street: z.string({
            required_error: "La calle es requerida"
        }),
        city: z.string({
            required_error: "La ciudad es requerida"
        }),
        state: z.string({
            required_error: "El estado es requerido"
        }),
        zipCode: z.string({
            required_error: "El código postal es requerido"
        }),
        coordinates: z.object({
            lat: z.preprocess(
                (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
                z.number().optional()
            ),
            lng: z.preprocess(
                (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
                z.number().optional()
            )
        }).optional()
    }),
    
    businessMode: z.enum(['sale', 'rent', 'both'], {
        required_error: "La modalidad de negocio es requerida"
    }).optional(),
    
    price: z.object({
        // Campos de venta
        sale: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number({
                invalid_type_error: "El precio debe ser un número"
            }).positive("El precio debe ser positivo").optional()
        ),
        taxes: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number().positive().optional()
        ),
        deedConditions: z.string().optional(),
        
        // Campos de renta
        monthlyRent: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number({
                invalid_type_error: "La renta debe ser un número"
            }).positive("La renta debe ser positiva").optional()
        ),
        deposit: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number().min(0).optional()
        ),
        leaseDuration: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number().positive().optional()
        ),
        maintenance: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number().min(0).optional()
        ),
        leaseConditions: z.string().optional(),
        
        currency: z.string().default("USD")
    }).optional(),
    
    details: z.object({
        bedrooms: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number({
                required_error: "El número de habitaciones es requerido",
                invalid_type_error: "El número de habitaciones debe ser un número"
            }).min(0, "Las habitaciones no pueden ser negativas")
        ),
        bathrooms: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number({
                required_error: "El número de baños es requerido",
                invalid_type_error: "El número de baños debe ser un número"
            }).min(0, "Los baños no pueden ser negativos")
        ),
        squareFeet: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number().optional()
        ),
        propertyType: z.enum(["house", "apartment", "condo", "townhouse"], {
            required_error: "El tipo de propiedad es requerido"
        }),
        yearBuilt: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number().optional()
        ),
        parking: z.preprocess(
            (val) => val === 'true' || val === true,
            z.boolean().default(false)
        ),
        petFriendly: z.preprocess(
            (val) => val === 'true' || val === true,
            z.boolean().default(false)
        ),
        furnished: z.preprocess(
            (val) => val === 'true' || val === true,
            z.boolean().default(false)
        )
    }),
    
    amenities: z.array(z.string()).optional(),
    
    availability: z.object({
        isAvailable: z.boolean().default(true),
        availableFrom: z.string().optional(),
        leaseTerm: z.string().optional()
    }).optional(),
    
    contact: z.object({
        phone: z.string().optional(),
        email: z.string().email("Email inválido").optional()
    }).optional()
});