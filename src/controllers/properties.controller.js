import Property from '../models/property.models.js';
import { v2 as cloudinary } from 'cloudinary';
import { sendMassNotification } from '../services/notificationService.js';

// Función para obtener todas las propiedades (admin / co-admin)
export const getProperties = async (req, res) => {
    try {
        // Admin y co-admin deben ver TODAS las propiedades, sin importar quién las creó
        const properties = await Property.find()
            .populate('createdBy', 'username email')
            .populate('lastModifiedBy', 'username email'); // Traer info del creador y modificador
        res.json(properties);
    } catch (error) {
        res.status(500)
            .json({ message: ['Error al obtener las propiedades'] });
    }
};

// Función para obtener todas las propiedades públicas (para visitantes)
export const getAllProperties = async (req, res) => {
    try {
        const properties = await Property.find({ 'availability.isAvailable': true })
            .populate('createdBy', 'username email')
            .populate('lastModifiedBy', 'username email'); // Traer info del creador y modificador
        res.json(properties);
    } catch (error) {
        res.status(500)
            .json({ message: ['Error al obtener todas las propiedades'] });
    }
};

// Función para crear una propiedad
export const createProperty = async (req, res) => {
    try {
        // Procesar campos anidados de FormData
        const processedBody = { ...req.body };
        
        // Convertir campos con notación de punto a objetos anidados
        Object.keys(req.body).forEach(key => {
            if (key.includes('.')) {
                const parts = key.split('.');
                let current = processedBody;
                
                // Crear estructura anidada
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }
                
                // Asignar valor (convertir a número si es lat o lng)
                const lastPart = parts[parts.length - 1];
                let value = req.body[key];
                
                if ((lastPart === 'lat' || lastPart === 'lng') && value) {
                    value = parseFloat(value);
                }
                
                current[lastPart] = value;
                delete processedBody[key];
            }
        });
        
        const {
            title,
            description,
            address,
            price,
            details,
            amenities,
            availability,
            contact,
            businessMode
        } = processedBody;

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
            businessMode,
            createdBy: req.user.id
        });

        const savedProperty = await newProperty.save();
        
        // ENVÍO AUTOMÁTICO DE NOTIFICACIONES MASIVAS
        try {
            // Only send notifications when Twilio is configured
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here') {
                console.log('Starting mass notification dispatch...');
                const notificationResult = await sendMassNotification(savedProperty, req.user.id);
                console.log('Notifications sent:', notificationResult.stats);
            } else {
                console.log('Twilio not configured - skipping SMS notifications');
            }
        } catch (notificationError) {
            console.error('Error en notificaciones masivas:', notificationError);
            // No fallar la creación de propiedad por error en notificaciones
        }
        
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
        const property = await Property.findById(req.params.id)
            .populate('createdBy', 'username email')
            .populate('lastModifiedBy', 'username email'); // Traer info del creador y modificador
        if (!property) {
            return res.status(404)
                .json({ message: ['Propiedad no encontrada'] });
        }
        res.json(property);
    } catch (error) {
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
                        // Convertir a número si es lat o lng
                        let finalValue = value;
                        if ((p === 'lat' || p === 'lng') && value) {
                            finalValue = parseFloat(value);
                        }
                        cur[p] = finalValue;
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
            contact,
            businessMode
        } = nestedBody;

        // Intentar convertir algunos campos simples a números/booleanos si vienen como strings
        const tryNum = (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);
        if (price) {
            if (price.sale !== undefined) price.sale = tryNum(price.sale);
            if (price.rent !== undefined) price.rent = tryNum(price.rent);
            if (price.deposit !== undefined) price.deposit = tryNum(price.deposit);
            if (price.monthlyRent !== undefined) price.monthlyRent = tryNum(price.monthlyRent);
            if (price.taxes !== undefined) price.taxes = tryNum(price.taxes);
            if (price.leaseDuration !== undefined) price.leaseDuration = tryNum(price.leaseDuration);
            if (price.maintenance !== undefined) price.maintenance = tryNum(price.maintenance);
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
            contact,
            businessMode,
            lastModifiedBy: req.user.id  // Guardar quién modificó
        };

        const updatedProperty = await Property.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        )
        .populate('createdBy', 'username email')
        .populate('lastModifiedBy', 'username email');

        res.json(updatedProperty);
    } catch (error) {
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

        // Guardar el estado anterior para comparar
        const previousStatus = property.status;

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
        
        // Si la propiedad vuelve a estar disponible, enviar notificaciones
        if (status === 'DISPONIBLE' && (previousStatus === 'EN_CONTRATO' || previousStatus === 'VENDIDA')) {
            console.log('✨ Propiedad vuelve a estar disponible, enviando notificaciones...');
            try {
                const { sendPropertyAvailableNotification } = await import('../services/notificationService.js');
                // No esperar la notificación (fire and forget)
                sendPropertyAvailableNotification(property, req.user.id)
                    .then(result => console.log('✅ Notificación de disponibilidad enviada:', result.notification._id))
                    .catch(err => console.error('❌ Error enviando notificación de disponibilidad:', err.message));
            } catch (error) {
                console.error('❌ Error al importar servicio de notificaciones:', error.message);
            }
        }
        
        res.json({ 
            message: `Estado cambiado a ${status}`, 
            property 
        });
    } catch (error) {
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
        res.status(500).json({ message: ['Error al obtener historial'] });
    }
};

// ========== DOCUMENT MANAGEMENT ==========

export const addDocuments = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        
        if (!property) {
            return res.status(404).json({ message: ['Property not found'] });
        }

        if (!req.uploadedDocuments || req.uploadedDocuments.length === 0) {
            return res.status(400).json({ message: ['No documents uploaded'] });
        }

        // Agregar información de quién subió el documento
        const documentsWithUser = req.uploadedDocuments.map(doc => ({
            ...doc,
            uploadedBy: req.user.id
        }));

        property.documents = [...(property.documents || []), ...documentsWithUser];
        await property.save();

        res.json({ 
            message: 'Documents uploaded successfully',
            documents: property.documents 
        });
    } catch (error) {
        console.error('Error adding documents:', error);
        res.status(500).json({ message: ['Error uploading documents'] });
    }
};

export const deleteDocument = async (req, res) => {
    try {
        const { id, documentId } = req.params;
        const property = await Property.findById(id);
        
        if (!property) {
            return res.status(404).json({ message: ['Property not found'] });
        }

        const documentIndex = property.documents.findIndex(
            doc => doc._id.toString() === documentId
        );

        if (documentIndex === -1) {
            return res.status(404).json({ message: ['Document not found'] });
        }

        const document = property.documents[documentIndex];
        
        // Eliminar de Cloudinary
        if (document.publicId) {
            try {
                const { deleteDocumentFromCloudinary } = await import('../middlewares/uploadDocument.js');
                await deleteDocumentFromCloudinary(document.publicId, document.fileType);
            } catch (error) {
                console.error('Error deleting from Cloudinary:', error);
            }
        }

        property.documents.splice(documentIndex, 1);
        await property.save();

        res.json({ 
            message: 'Document deleted successfully',
            documents: property.documents 
        });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ message: ['Error deleting document'] });
    }
};
