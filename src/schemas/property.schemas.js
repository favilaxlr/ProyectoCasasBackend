import { z } from 'zod';

export const propertySchema = z.object({
    title: z.string({
        required_error: "Title is required"
    }).min(1, "Title cannot be empty"),
    
    description: z.string({
        required_error: "Description is required"
    }).min(10, "Description must be at least 10 characters"),
    
    address: z.object({
        street: z.string({
            required_error: "Street is required"
        }),
        city: z.string({
            required_error: "City is required"
        }),
        state: z.string({
            required_error: "State is required"
        }),
        zipCode: z.string({
            required_error: "Zip code is required"
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
        required_error: "Business mode is required"
    }).optional(),
    
    price: z.object({
        // Campos de venta
        sale: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number({
                invalid_type_error: "Price must be a number"
            }).positive("Price must be positive").optional()
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
                invalid_type_error: "Rent must be a number"
            }).positive("Rent must be positive").optional()
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
                required_error: "Number of bedrooms is required",
                invalid_type_error: "Number of bedrooms must be a number"
            }).min(0, "Bedrooms cannot be negative")
        ),
        bathrooms: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number({
                required_error: "Number of bathrooms is required",
                invalid_type_error: "Number of bathrooms must be a number"
            }).min(0, "Bathrooms cannot be negative")
        ),
        squareFeet: z.preprocess(
            (val) => val === '' || val === null || val === undefined ? undefined : Number(val),
            z.number().optional()
        ),
        propertyType: z.enum(["house", "apartment", "condo", "townhouse"], {
            required_error: "Property type is required"
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
        email: z.string().email("Invalid email").optional()
    }).optional()
});