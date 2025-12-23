import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { isAdminOrCoAdmin } from '../middlewares/isAdminOrCoAdmin.js';

import {
    getStats,
    getNotificationHistory,
    getNotificationDetails,
    resendFailed,
    previewMessage
} from '../controllers/notifications.controller.js';

const router = Router();

// Todas las rutas requieren autenticación y permisos de admin/co-admin
router.use(authRequired, isAdminOrCoAdmin);

// Obtener estadísticas básicas
router.get('/notifications/stats', getStats);

// Obtener historial de notificaciones
router.get('/notifications/history', getNotificationHistory);

// Obtener detalles de una notificación específica
router.get('/notifications/:id', getNotificationDetails);

// Reenviar notificaciones fallidas
router.post('/notifications/:id/resend', resendFailed);

// Vista previa del mensaje
router.get('/notifications/preview/:propertyId', previewMessage);

export default router;