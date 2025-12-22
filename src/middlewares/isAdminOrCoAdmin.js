import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import dotenv from 'dotenv';

dotenv.config();

const roleAdmin = process.env.SETUP_ROLE_ADMIN;

export const isAdminOrCoAdmin = async (req, res, next) => {
    try {
        const userFound = await User.findById(req.user.id);

        if (!userFound) {
            return res.status(400)
                .json({ message: ["No autorizado, usuario no encontrado"] }); 
        }

        const role = await Role.findById(userFound.role);
        if (!role) {
            return res.status(401)
                .json({ message: ["No autorizado, rol no definido"] });
        }

        // Permitir admin y co-admin
        if (role.role !== roleAdmin && role.role !== 'co-admin') {
            return res.status(401)
                .json({ message: ["No autorizado para esta operación"] });
        }

        next();
    } catch (error) {
        return res.status(401)
            .json({ message: ["No autorizado"] });
    }
};