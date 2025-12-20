import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { isAdminOrCoAdmin } from '../middlewares/isAdminOrCoAdmin.js';
import { uploadToCloudinary } from '../middlewares/uploadImage.js';
import multer from 'multer';
import { validateSchema } from '../middlewares/validateSchemas.js';

import {
    getProperties,
    getAllProperties,
    createProperty,
    getProperty,
    updateProperty,
    deleteProperty,
    addImages,
    deleteImage,
    setMainImage,
    changePropertyStatus,
    getPropertyHistory
} from '../controllers/properties.controller.js';

// Importamos los schemas de validación
import { propertySchema } from '../schemas/property.schemas.js';

const router = Router();

// Rutas públicas (sin autenticación)
router.get('/properties/public', getAllProperties); // Todas las propiedades disponibles
router.get('/properties/public/:id', getProperty); // Ver una propiedad específica

// Rutas administrativas (requieren autenticación y ser admin o co-admin)
router.get('/properties', authRequired, isAdminOrCoAdmin, getProperties); // Propiedades del admin
router.post('/properties', authRequired, isAdminOrCoAdmin, uploadToCloudinary, validateSchema(propertySchema), createProperty); // Crear propiedad
const formParser = multer().any();
router.put('/properties/:id', authRequired, isAdminOrCoAdmin, formParser, updateProperty); // Actualizar propiedad
router.delete('/properties/:id', authRequired, isAdminOrCoAdmin, deleteProperty); // Eliminar propiedad

// Rutas para gestión de imágenes
router.post('/properties/:id/images', authRequired, isAdminOrCoAdmin, uploadToCloudinary, addImages); // Agregar imágenes
router.delete('/properties/:id/images/:imageId', authRequired, isAdminOrCoAdmin, deleteImage); // Eliminar imagen
router.put('/properties/:id/images/:imageId/main', authRequired, isAdminOrCoAdmin, setMainImage); // Establecer imagen principal

// Rutas para gestión de estados
router.put('/properties/:id/status', authRequired, isAdminOrCoAdmin, changePropertyStatus); // Cambiar estado
router.get('/properties/:id/history', authRequired, isAdminOrCoAdmin, getPropertyHistory); // Ver historial

export default router;