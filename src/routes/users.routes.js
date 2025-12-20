import { Router } from 'express';
import { 
    getUsers, 
    getUser, 
    changeUserRole, 
    getRoles, 
    deleteUser 
} from '../controllers/users.controller.js';
import { validateToken } from '../middlewares/validateToken.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(validateToken);
router.use(isAdmin);

// Rutas de usuarios
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.put('/users/:id/role', changeUserRole);
router.delete('/users/:id', deleteUser);

// Rutas de roles
router.get('/roles', getRoles);

export default router;