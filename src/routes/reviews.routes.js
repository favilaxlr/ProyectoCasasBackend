import { Router } from 'express';
import { 
    createReview,
    getPropertyReviews,
    getPendingReviews,
    moderateReview,
    toggleFeaturedReview,
    voteHelpful,
    deleteReview
} from '../controllers/reviews.controller.js';
import { authRequired } from '../middlewares/validateToken.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { isAdminOrCoAdmin } from '../middlewares/isAdminOrCoAdmin.js';
import { uploadToCloudinary } from '../middlewares/uploadImage.js';
import { validateSchema } from '../middlewares/validateSchemas.js';

const router = Router();

// Rutas públicas
router.get('/properties/:propertyId/reviews', getPropertyReviews); // Ver reseñas de una propiedad

// Rutas para usuarios registrados
router.post('/reviews', authRequired, uploadToCloudinary, createReview); // Crear reseña
router.post('/reviews/:id/helpful', authRequired, voteHelpful); // Votar reseña como útil

// Rutas para admin y co-admin
router.get('/reviews/pending', authRequired, isAdminOrCoAdmin, getPendingReviews); // Ver reseñas pendientes
router.put('/reviews/:id/moderate', authRequired, isAdminOrCoAdmin, moderateReview); // Moderar reseña
router.delete('/reviews/:id', authRequired, isAdminOrCoAdmin, deleteReview); // Eliminar reseña

// Rutas solo para admin
router.put('/reviews/:id/featured', authRequired, isAdmin, toggleFeaturedReview); // Destacar reseña

export default router;