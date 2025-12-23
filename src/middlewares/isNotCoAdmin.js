import User from '../models/user.models.js';
import Role from '../models/roles.models.js';

// Middleware que rechaza a co-admins pero permite a usuarios normales y admins
export const isNotCoAdmin = async (req, res, next) => {
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

        // Rechazar si es co-admin
        if (role.role === 'co-admin') {
            return res.status(403)
                .json({ message: ["Los co-administradores no pueden agendar citas"] });
        }

        next();
    } catch (error) {
        return res.status(401)
            .json({ message: ["No autorizado"] });
    }
};
