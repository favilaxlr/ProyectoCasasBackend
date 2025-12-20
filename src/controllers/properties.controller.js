import Property from '../models/property.models.js';
import { v2 as cloudinary } from 'cloudinary';

// Función para obtener todas las propiedades (admin)
export const getProperties = async (req, res) => {
    try {
        const properties = await Property.find({ createdBy: req.user.id });
        res.json(properties);
    } catch (error) {
        console.log(error);
        res.status(500)
            .json({ message: ['Error al obtener las propiedades'] });
    }
};

// Función para obtener todas las propiedades públicas (para visitantes)
export const getAllProperties = async (req, res) => {
    try {
        const properties = await Property.find({ 'availability.isAvailable': true });
        res.json(properties);
    } catch (error) {
        console.log(error);
        res.status(500)
            .json({ message: ['Error al obtener todas las propiedades'] });
    }
};

// Función para crear una propiedad
export const createProperty = async (req, res) => {
    try {
        console.log('CreateProperty - req.body:', req.body);
        console.log('CreateProperty - req.files:', req.files);
        const {
            title,
            description,
            address,
            price,
            details,
            amenities,
            availability,
            contact
        } = req.body;

        // Procesar imágenes (hasta 10 máximo)
        let images = [];
        if (req.files && req.files.length > 0) {
            const maxImages = Math.min(req.files.length, 10);
            images = req.files.slice(0, maxImages).map((file, index) => ({
                url: file.path,
                publicId: file.filename,
                isMain: index === 0,
                caption: ''
            }));
        }

        const newProperty = new Property({
            title,
            description,
            address,
            price,
            details,
            images,
            amenities: Array.isArray(amenities)
                ? amenities
                : (typeof amenities === 'string' ? amenities.split(',').map(s=>s.trim()).filter(Boolean) : []),
            availability,
            contact,
            createdBy: req.user.id
        });

        const savedProperty = await newProperty.save();
        res.json(savedProperty);
    } catch (error) {
        console.error('Error al crear propiedad:', error);
        // Si es error de validación de Mongoose, devolver 400 con detalles
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: messages });
        }
        res.status(500)
            .json({ message: ['Error al crear la propiedad'] });
    }
};

// Función para obtener una propiedad por ID
export const getProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404)
                .json({ message: ['Propiedad no encontrada'] });
        }
        res.json(property);
    } catch (error) {
        console.log(error);
        res.status(500)
            .json({ message: ['Error al obtener la propiedad'] });
    }
};

// Función para eliminar una propiedad
export const deleteProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404)
                .json({ message: ['Propiedad no encontrada'] });
        }

        // Eliminar todas las imágenes de Cloudinary
        for (const image of property.images) {
            if (image.publicId) {
                await cloudinary.uploader.destroy(image.publicId);
            }
        }

        const deletedProperty = await Property.findByIdAndDelete(req.params.id);
        if (!deletedProperty) {
            return res.status(404)
                .json({ message: ['Propiedad no eliminada'] });
        }

        res.json(deletedProperty);
    } catch (error) {
        console.log(error);
        res.status(500)
            .json({ message: ['Error al eliminar la propiedad'] });
    }
};

// Función para actualizar una propiedad
export const updateProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404)
                .json({ message: ['Propiedad no encontrada'] });
        }

        // Si el body viene de FormData los campos pueden ser planos con puntos (e.g. 'price.rent')
        const unflatten = (obj) => {
            const res = {};
            for (const key of Object.keys(obj)) {
                const value = obj[key];
                if (!key.includes('.')) {
                    res[key] = value;
                    continue;
                }
                const parts = key.split('.');
                let cur = res;
                for (let i = 0; i < parts.length; i++) {
                    const p = parts[i];
                    if (i === parts.length - 1) {
                        cur[p] = value;
                    } else {
                        cur[p] = cur[p] || {};
                        cur = cur[p];
                    }
                }
            }
            return res;
        };

        const nestedBody = unflatten(req.body);

        const {
            title,
            description,
            address,
            price,
            details,
            amenities,
            availability,
            contact
        } = nestedBody;

        // Intentar convertir algunos campos simples a números/booleanos si vienen como strings
        const tryNum = (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
        if (price) {
            if (price.rent !== undefined) price.rent = tryNum(price.rent);
            if (price.deposit !== undefined) price.deposit = tryNum(price.deposit);
        }
        if (details) {
            if (details.bedrooms !== undefined) details.bedrooms = tryNum(details.bedrooms);
            if (details.bathrooms !== undefined) details.bathrooms = tryNum(details.bathrooms);
            if (details.squareFeet !== undefined) details.squareFeet = tryNum(details.squareFeet);
            if (details.yearBuilt !== undefined) details.yearBuilt = tryNum(details.yearBuilt);
            if (typeof details.parking === 'string') details.parking = details.parking === 'true' || details.parking === 'on';
            if (typeof details.petFriendly === 'string') details.petFriendly = details.petFriendly === 'true' || details.petFriendly === 'on';
            if (typeof details.furnished === 'string') details.furnished = details.furnished === 'true' || details.furnished === 'on';
        }

        const updateData = {
            title,
            description,
            address,
            price,
            details,
            amenities: Array.isArray(amenities)
                ? amenities
                : (typeof amenities === 'string' ? amenities.split(',').map(s=>s.trim()).filter(Boolean) : []),
            availability,
            contact
        };

        const updatedProperty = await Property.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        res.json(updatedProperty);
    } catch (error) {
        console.log(error);
        res.status(500)
            .json({ message: ['Error al actualizar la propiedad'] });
    }
};

// Función para agregar imágenes a una propiedad
export const addImages = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ message: ['Propiedad no encontrada'] });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: ['No se enviaron imágenes'] });
        }

        const newImages = req.files.map(file => ({
            url: file.path,
            publicId: file.filename,
            isMain: property.images.length === 0, // Primera imagen es principal si no hay otras
            caption: ''
        }));

        property.images.push(...newImages);
        await property.save();

        res.json({ message: 'Imágenes agregadas', property });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al agregar imágenes'] });
    }
};

// Función para eliminar una imagen específica
export const deleteImage = async (req, res) => {
    try {
        const { id, imageId } = req.params;
        
        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: ['Propiedad no encontrada'] });
        }

        const imageIndex = property.images.findIndex(img => img._id.toString() === imageId);
        if (imageIndex === -1) {
            return res.status(404).json({ message: ['Imagen no encontrada'] });
        }

        const image = property.images[imageIndex];
        
        // Eliminar de Cloudinary
        if (image.publicId) {
            await cloudinary.uploader.destroy(image.publicId);
        }

        // Eliminar del array
        property.images.splice(imageIndex, 1);
        
        // Si era la imagen principal y quedan más imágenes, hacer la primera como principal
        if (image.isMain && property.images.length > 0) {
            property.images[0].isMain = true;
        }

        await property.save();
        res.json({ message: 'Imagen eliminada', property });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al eliminar imagen'] });
    }
};

// Función para establecer imagen principal
export const setMainImage = async (req, res) => {
    try {
        const { id, imageId } = req.params;
        
        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({ message: ['Propiedad no encontrada'] });
        }

        // Quitar isMain de todas las imágenes
        property.images.forEach(img => img.isMain = false);
        
        // Establecer la nueva imagen principal
        const targetImage = property.images.find(img => img._id.toString() === imageId);
        if (!targetImage) {
            return res.status(404).json({ message: ['Imagen no encontrada'] });
        }
        
        targetImage.isMain = true;
        await property.save();
        
        res.json({ message: 'Imagen principal actualizada', property });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al establecer imagen principal'] });
    }
};

// Función para cambiar estado de propiedad
export const changePropertyStatus = async (req, res) => {
    try {
        const { status, reason } = req.body;
        const validStatuses = ['DISPONIBLE', 'EN_CONTRATO', 'VENDIDA'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: ['Estado inválido'] });
        }

        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ message: ['Propiedad no encontrada'] });
        }

        // Agregar al historial
        property.statusHistory.push({
            status: property.status,
            changedBy: req.user.id,
            reason: reason || 'Cambio de estado',
            changedAt: new Date()
        });

        // Actualizar estado
        property.status = status;
        
        // Si se marca como vendida, marcar como no disponible
        if (status === 'VENDIDA') {
            property.availability.isAvailable = false;
        } else if (status === 'DISPONIBLE') {
            property.availability.isAvailable = true;
        }

        await property.save();
        
        res.json({ 
            message: `Estado cambiado a ${status}`, 
            property 
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al cambiar estado'] });
    }
};

// Función para obtener historial de una propiedad
export const getPropertyHistory = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id)
            .populate('statusHistory.changedBy', 'username')
            .select('statusHistory');
            
        if (!property) {
            return res.status(404).json({ message: ['Propiedad no encontrada'] });
        }

        res.json(property.statusHistory);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al obtener historial'] });
    }
};