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
            lat: z.number().optional(),
            lng: z.number().optional()
        }).optional()
    }),
    
    price: z.object({
        sale: z.number({
            required_error: "El precio de venta es requerido"
        }).positive("El precio debe ser positivo"),
        currency: z.string().default("USD")
    }),
    
    details: z.object({
        bedrooms: z.number({
            required_error: "El número de habitaciones es requerido"
        }).min(0, "Las habitaciones no pueden ser negativas"),
        bathrooms: z.number({
            required_error: "El número de baños es requerido"
        }).min(0, "Los baños no pueden ser negativos"),
        squareFeet: z.number().optional(),
        propertyType: z.enum(["house", "apartment", "condo", "townhouse"], {
            required_error: "El tipo de propiedad es requerido"
        }),
        yearBuilt: z.number().optional(),
        parking: z.boolean().default(false),
        petFriendly: z.boolean().default(false),
        furnished: z.boolean().default(false)
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