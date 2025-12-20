import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema(
    {
        // Información básica de la propiedad
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        
        // Dirección completa
        address: {
            street: {
                type: String,
                required: true
            },
            city: {
                type: String,
                required: true
            },
            state: {
                type: String,
                required: true
            },
            zipCode: {
                type: String,
                required: true
            },
            // Coordenadas para el mapa
            coordinates: {
                lat: Number,
                lng: Number
            }
        },
        
        // Precios
        price: {
            rent: {
                type: Number,
                required: true
            },
            deposit: Number,
            currency: {
                type: String,
                default: "USD"
            }
        },
        
        // Detalles de la propiedad
        details: {
            bedrooms: {
                type: Number,
                required: true
            },
            bathrooms: {
                type: Number,
                required: true
            },
            squareFeet: Number,
            propertyType: {
                type: String,
                enum: ["house", "apartment", "condo", "townhouse"],
                required: true
            },
            yearBuilt: Number,
            parking: {
                type: Boolean,
                default: false
            },
            petFriendly: {
                type: Boolean,
                default: false
            },
            furnished: {
                type: Boolean,
                default: false
            }
        },
        
        // Múltiples imágenes (antes era solo una)
        images: [{
            url: {
                type: String,
                required: true
            },
            publicId: String,
            isMain: {
                type: Boolean,
                default: false
            },
            caption: String
        }],
        
        // Comodidades (piscina, gym, etc.)
        amenities: [String],
        
        // Disponibilidad y Estado
        availability: {
            isAvailable: {
                type: Boolean,
                default: true
            },
            availableFrom: Date,
            leaseTerm: String
        },
        
        // Estado de la propiedad
        status: {
            type: String,
            enum: ["DISPONIBLE", "EN_CONTRATO", "VENDIDA"],
            default: "DISPONIBLE"
        },
        
        // Historial de cambios de estado
        statusHistory: [{
            status: {
                type: String,
                enum: ["DISPONIBLE", "EN_CONTRATO", "VENDIDA"]
            },
            changedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            reason: String,
            changedAt: {
                type: Date,
                default: Date.now
            }
        }],
        
        // Contacto
        contact: {
            phone: String,
            email: String
        },
        
        // Quién creó la propiedad (admin)
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        
        // Rating promedio de reseñas
        rating: {
            average: {
                type: Number,
                default: 0,
                min: 0,
                max: 5
            },
            count: {
                type: Number,
                default: 0
            }
        }
    },
    {
        timestamps: true // Esto agrega createdAt y updatedAt automáticamente
    }
);

export default mongoose.model('Property', propertySchema);