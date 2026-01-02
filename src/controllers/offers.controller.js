import Offer from '../models/offer.models.js';
import Property from '../models/property.models.js';

// ========== USER ENDPOINTS ==========

// Crear una nueva oferta
export const createOffer = async (req, res) => {
    try {
        const { propertyId, offerAmount, message } = req.body;

        // Verificar que la propiedad existe
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: ['Property not found'] });
        }

        // Verificar si el usuario ya tiene una oferta pendiente para esta propiedad
        const existingOffer = await Offer.findOne({
            property: propertyId,
            user: req.user.id,
            status: { $in: ['pending', 'in_progress'] }
        });

        if (existingOffer) {
            return res.status(400).json({ 
                message: ['You already have an active offer for this property'] 
            });
        }

        // Crear la oferta con el primer mensaje
        const offer = new Offer({
            property: propertyId,
            user: req.user.id,
            offerAmount,
            messages: [{
                sender: req.user.id,
                content: message,
                createdAt: new Date()
            }],
            unreadCount: {
                user: 0,
                admin: 1 // El admin tiene 1 mensaje sin leer
            }
        });

        await offer.save();

        // Poblar los datos antes de devolver
        await offer.populate('property', 'title address images');
        await offer.populate('user', 'username email phone profileImage');
        await offer.populate('messages.sender', 'username profileImage');

        res.status(201).json(offer);
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({ message: ['Error creating offer'] });
    }
};

// Obtener ofertas del usuario autenticado
export const getUserOffers = async (req, res) => {
    try {
        const offers = await Offer.find({ user: req.user.id })
            .populate('property', 'title address images price status')
            .populate('assignedTo', 'username profileImage')
            .sort({ updatedAt: -1 });

        res.json(offers);
    } catch (error) {
        console.error('Error getting user offers:', error);
        res.status(500).json({ message: ['Error getting offers'] });
    }
};

// Obtener una oferta específica del usuario
export const getUserOffer = async (req, res) => {
    try {
        const offer = await Offer.findOne({
            _id: req.params.id,
            user: req.user.id
        })
            .populate('property', 'title address images price')
            .populate('user', 'username email')
            .populate('assignedTo', 'username')
            .populate('messages.sender', 'username');

        if (!offer) {
            return res.status(404).json({ message: ['Offer not found'] });
        }

        // Marcar mensajes del admin como leídos
        let hasUnread = false;
        offer.messages.forEach(msg => {
            if (msg.sender.toString() !== req.user.id && !msg.read) {
                msg.read = true;
                hasUnread = true;
            }
        });

        if (hasUnread) {
            offer.unreadCount.user = 0;
            await offer.save();
        }

        res.json(offer);
    } catch (error) {
        console.error('Error getting offer:', error);
        res.status(500).json({ message: ['Error getting offer'] });
    }
};

// Enviar mensaje en una oferta (usuario)
export const sendMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const offer = await Offer.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!offer) {
            return res.status(404).json({ message: ['Offer not found'] });
        }

        offer.messages.push({
            sender: req.user.id,
            content,
            createdAt: new Date()
        });

        // Incrementar contador de no leídos para admin
        offer.unreadCount.admin += 1;

        await offer.save();
        await offer.populate('messages.sender', 'username profileImage');

        res.json(offer);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: ['Error sending message'] });
    }
};

// ========== ADMIN/CO-ADMIN ENDPOINTS ==========

// Obtener todas las ofertas pendientes (no asignadas)
export const getPendingOffers = async (req, res) => {
    try {
        const offers = await Offer.find({ 
            status: 'pending',
            assignedTo: null 
        })
            .populate('property', 'title address images price')
            .populate('user', 'username email phone profileImage')
            .sort({ createdAt: -1 });

        res.json(offers);
    } catch (error) {
        console.error('Error getting pending offers:', error);
        res.status(500).json({ message: ['Error getting offers'] });
    }
};

// Obtener ofertas asignadas al admin/co-admin autenticado
export const getMyAssignedOffers = async (req, res) => {
    try {
        const offers = await Offer.find({ 
            assignedTo: req.user.id,
            status: { $in: ['in_progress', 'pending'] }
        })
            .populate('property', 'title address images price')
            .populate('user', 'username email phone profileImage')
            .sort({ updatedAt: -1 });

        res.json(offers);
    } catch (error) {
        console.error('Error getting assigned offers:', error);
        res.status(500).json({ message: ['Error getting offers'] });
    }
};

// Tomar una oferta (asignarla al admin/co-admin)
export const takeOffer = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);

        if (!offer) {
            return res.status(404).json({ message: ['Offer not found'] });
        }

        if (offer.assignedTo) {
            return res.status(400).json({ message: ['Offer already assigned'] });
        }

        offer.assignedTo = req.user.id;
        offer.assignedAt = new Date();
        offer.status = 'in_progress';

        await offer.save();
        await offer.populate('property', 'title address images price');
        await offer.populate('user', 'username email phone profileImage');
        await offer.populate('assignedTo', 'username profileImage');

        res.json(offer);
    } catch (error) {
        console.error('Error taking offer:', error);
        res.status(500).json({ message: ['Error taking offer'] });
    }
};

// Obtener detalles de una oferta asignada
export const getAssignedOffer = async (req, res) => {
    try {
        const offer = await Offer.findOne({
            _id: req.params.id,
            assignedTo: req.user.id
        })
            .populate('property', 'title address images price')
            .populate('user', 'username email')
            .populate('assignedTo', 'username')
            .populate('messages.sender', 'username');

        if (!offer) {
            return res.status(404).json({ message: ['Offer not found'] });
        }

        // Marcar mensajes del usuario como leídos
        let hasUnread = false;
        offer.messages.forEach(msg => {
            if (msg.sender.toString() !== req.user.id && !msg.read) {
                msg.read = true;
                hasUnread = true;
            }
        });

        if (hasUnread) {
            offer.unreadCount.admin = 0;
            await offer.save();
        }

        res.json(offer);
    } catch (error) {
        console.error('Error getting offer:', error);
        res.status(500).json({ message: ['Error getting offer'] });
    }
};

// Enviar mensaje en una oferta asignada (admin/co-admin)
export const sendAdminMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const offer = await Offer.findOne({
            _id: req.params.id,
            assignedTo: req.user.id
        });

        if (!offer) {
            return res.status(404).json({ message: ['Offer not found or not assigned to you'] });
        }

        offer.messages.push({
            sender: req.user.id,
            content,
            createdAt: new Date()
        });

        // Incrementar contador de no leídos para el usuario
        offer.unreadCount.user += 1;

        await offer.save();
        await offer.populate('messages.sender', 'username profileImage');

        res.json(offer);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: ['Error sending message'] });
    }
};

// Cambiar estado de una oferta
export const updateOfferStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const offer = await Offer.findOne({
            _id: req.params.id,
            assignedTo: req.user.id
        });

        if (!offer) {
            return res.status(404).json({ message: ['Offer not found or not assigned to you'] });
        }

        offer.status = status;
        await offer.save();

        res.json(offer);
    } catch (error) {
        console.error('Error updating offer status:', error);
        res.status(500).json({ message: ['Error updating offer status'] });
    }
};

// Obtener todas las ofertas (para admin principal)
export const getAllOffers = async (req, res) => {
    try {
        const offers = await Offer.find()
            .populate('property', 'title address images price')
            .populate('user', 'username email phone profileImage')
            .populate('assignedTo', 'username profileImage')
            .sort({ updatedAt: -1 });

        res.json(offers);
    } catch (error) {
        console.error('Error getting all offers:', error);
        res.status(500).json({ message: ['Error getting offers'] });
    }
};
