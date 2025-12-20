import { Router } from 'express';
import { login, logout, profile, register, verifyToken } from '../controllers/auth.controller.js';
import { authRequired } from '../middlewares/validateToken.js';

//Importamos el validatorSchema
import { validateSchema } from '../middlewares/validateSchemas.js';

//Importamos los esquemas de validacion
import { registerSchema, loginSchema } from '../schemas/auth.schemas.js';

const router = Router();

//Ruta para validar el token
router.get('/verify', verifyToken)

//Ruta para registrar usuarios
router.post('/register', validateSchema(registerSchema),register);

//Ruta para iniciar sesión
router.post('/login',validateSchema(loginSchema), login);

//Ruto para cerrar sesión
router.post('/logout', logout);

//Ruta para el perfil del usuario
router.get('/profile', authRequired, profile);

export default router;