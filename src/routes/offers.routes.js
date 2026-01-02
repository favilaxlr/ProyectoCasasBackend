import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { isAdminOrCoAdmin } from '../middlewares/isAdminOrCoAdmin.js';
import {
    createOffer,
    getUserOffers,
    getUserOffer,
    sendMessage,
    getPendingOffers,
    getMyAssignedOffers,
    takeOffer,
    getAssignedOffer,
    sendAdminMessage,
    updateOfferStatus,
    getAllOffers
} from '../controllers/offers.controller.js';

const router = Router();

// ========== USER ROUTES ==========
// Crear una oferta para una propiedad
router.post('/offers', authRequired, createOffer);

// Obtener todas las ofertas del usuario
router.get('/offers/my-offers', authRequired, getUserOffers);

// Obtener una oferta específica del usuario y marcar mensajes como leídos
router.get('/offers/my-offers/:id', authRequired, getUserOffer);

// Enviar un mensaje en una oferta del usuario
router.post('/offers/my-offers/:id/messages', authRequired, sendMessage);

// ========== ADMIN/CO-ADMIN ROUTES ==========
// Obtener todas las ofertas pendientes (no asignadas)
router.get('/offers/pending', authRequired, isAdminOrCoAdmin, getPendingOffers);

// Obtener ofertas asignadas al admin/co-admin
router.get('/offers/assigned', authRequired, isAdminOrCoAdmin, getMyAssignedOffers);

// Tomar una oferta pendiente
router.post('/offers/:id/take', authRequired, isAdminOrCoAdmin, takeOffer);

// Obtener detalles de una oferta asignada
router.get('/offers/assigned/:id', authRequired, isAdminOrCoAdmin, getAssignedOffer);

// Enviar mensaje en una oferta asignada
router.post('/offers/assigned/:id/messages', authRequired, isAdminOrCoAdmin, sendAdminMessage);

// Actualizar estado de una oferta
router.put('/offers/:id/status', authRequired, isAdminOrCoAdmin, updateOfferStatus);

// Obtener todas las ofertas (solo para admin principal)
router.get('/offers/all', authRequired, isAdminOrCoAdmin, getAllOffers);

export default router;
