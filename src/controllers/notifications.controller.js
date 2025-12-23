import { getNotificationStats, resendFailedNotifications } from '../services/notificationService.js';
import Notification from '../models/notification.models.js';

// Obtener estadísticas de notificaciones
export const getStats = async (req, res) => {
    try {
        const stats = await getNotificationStats();
        res.json(stats);
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ message: ['Error al obtener estadísticas'] });
    }
};

// Obtener historial completo de notificaciones
export const getNotificationHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const notifications = await Notification.find()
            .populate('property', 'title address.city')
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Notification.countDocuments();

        res.json({
            notifications,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ message: ['Error al obtener historial'] });
    }
};

// Obtener detalles de una notificación específica
export const getNotificationDetails = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id)
            .populate('property')
            .populate('createdBy', 'username email');

        if (!notification) {
            return res.status(404).json({ message: ['Notificación no encontrada'] });
        }

        res.json(notification);
    } catch (error) {
        console.error('Error obteniendo detalles:', error);
        res.status(500).json({ message: ['Error al obtener detalles'] });
    }
};

// Reenviar notificaciones fallidas
export const resendFailed = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await resendFailedNotifications(id);
        
        res.json({
            message: 'Reenvío completado',
            result
        });
    } catch (error) {
        console.error('Error reenviando:', error);
        res.status(500).json({ 
            message: [error.message || 'Error al reenviar notificaciones'] 
        });
    }
};

// Vista previa del mensaje para nueva propiedad
export const previewMessage = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        // Simular el mensaje que se enviaría
        const baseUrl = process.env.BASE_URL_FRONTEND;
        const mockProperty = {
            title: "Casa Ejemplo",
            price: { rent: 2500 },
            details: { bedrooms: 3, bathrooms: 2 },
            address: { city: "Dallas" },
            _id: propertyId
        };
        
        const message = `NUEVA PROPIEDAD DISPONIBLE - FR Family Investments. Propiedad: ${mockProperty.title}. Precio: $${mockProperty.price.rent.toLocaleString()}/mes. Recámaras: ${mockProperty.details.bedrooms}. Baños: ${mockProperty.details.bathrooms}. Ubicación: ${mockProperty.address.city}, Dallas. Ver detalles: ${baseUrl}/properties/${mockProperty._id}`;
        
        res.json({
            message,
            length: message.length,
            maxLength: 160 // Límite típico de SMS
        });
    } catch (error) {
        console.error('Error generando vista previa:', error);
        res.status(500).json({ message: ['Error al generar vista previa'] });
    }
};