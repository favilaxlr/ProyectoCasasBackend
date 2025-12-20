import User from '../models/user.models.js';
import Role from '../models/roles.models.js';

// Obtener todos los usuarios (solo admin)
export const getUsers = async (req, res) => {
    try {
        const users = await User.find()
            .populate('role', 'role')
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.json(users);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al obtener usuarios'] });
    }
};

// Obtener un usuario por ID
export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('role', 'role')
            .select('-password');
        
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json(user);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al obtener usuario'] });
    }
};

// Cambiar rol de usuario (solo admin)
export const changeUserRole = async (req, res) => {
    try {
        const { roleId } = req.body;
        
        // Verificar que el rol existe
        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({ message: ['Rol no encontrado'] });
        }
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role: roleId },
            { new: true }
        ).populate('role', 'role').select('-password');
        
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json({ 
            message: `Rol actualizado a ${role.role}`, 
            user 
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al cambiar rol'] });
    }
};

// Obtener todos los roles disponibles
export const getRoles = async (req, res) => {
    try {
        const roles = await Role.find();
        res.json(roles);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al obtener roles'] });
    }
};

// Eliminar usuario (solo admin)
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: ['Error al eliminar usuario'] });
    }
};