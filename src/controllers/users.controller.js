import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import { v2 as cloudinary } from 'cloudinary';

// Obtener todos los usuarios (solo admin)
export const getUsers = async (req, res) => {
    try {
        const users = await User.find()
            .populate('role', 'role')
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.json(users);
    } catch (error) {
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

        // Verificar que el usuario no sea el mismo admin haciendo cambio a sí mismo
        if (req.params.id === req.user.id && role.role !== 'admin') {
            return res.status(403).json({ message: ['No puedes cambiar tu propio rol'] });
        }
        
        // Preparar la actualización
        const updateData = { role: roleId };
        
        // Si el nuevo rol es admin o co-admin, marcar como verificado automáticamente
        if (role.role === 'admin' || role.role === 'co-admin') {
            updateData.isEmailVerified = true;
            updateData.isPhoneVerified = true;
        }
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('role', 'role').select('-password');
        
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json({ message: 'Rol actualizado correctamente', user });
    } catch (error) {
        res.status(500).json({ message: ['Error al cambiar rol de usuario'] });
    }
};

// Obtener todos los roles disponibles
export const getRoles = async (req, res) => {
    try {
        const roles = await Role.find();
        res.json(roles);
    } catch (error) {
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
        res.status(500).json({ message: ['Error al eliminar usuario'] });
    }
};

// Actualizar perfil de usuario (el propio usuario)
export const updateProfile = async (req, res) => {
    try {
        const { username, email, phone } = req.body;
        
        // Validaciones básicas
        if (!username || !email) {
            return res.status(400).json({ message: ['Nombre de usuario y email son obligatorios'] });
        }

        // Verificar si el email ya está en uso por otro usuario
        const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
        if (existingUser) {
            return res.status(400).json({ message: ['El email ya está en uso'] });
        }

        // Actualizar usuario
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { username, email, phone },
            { new: true }
        ).populate('role', 'role').select('-password');
        
        if (!updatedUser) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json({ message: 'Perfil actualizado correctamente', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: ['Error al actualizar perfil'] });
    }
};

// Cambiar contraseña del usuario (el propio usuario)
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validaciones
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: ['Contraseña actual y nueva son obligatorias'] });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: ['La nueva contraseña debe tener al menos 8 caracteres'] });
        }

        // Buscar usuario con password
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }

        // Verificar contraseña actual
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: ['La contraseña actual es incorrecta'] });
        }

        // Actualizar contraseña
        user.password = newPassword;
        await user.save();
        
        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ message: ['Error al cambiar contraseña'] });
    }
};

// Actualizar foto de perfil
export const updateProfileImage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }

        // Eliminar imagen anterior de Cloudinary si existe
        if (user.profileImage?.publicId) {
            try {
                await cloudinary.uploader.destroy(user.profileImage.publicId);
            } catch (error) {
                console.error('Error al eliminar imagen anterior:', error);
            }
        }

        // Actualizar con la nueva imagen
        user.profileImage = {
            url: req.urlImage,
            publicId: req.publicId
        };

        await user.save();

        const updatedUser = await User.findById(req.user.id)
            .populate('role', 'role')
            .select('-password');
        
        res.json({ message: 'Foto de perfil actualizada correctamente', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: ['Error al actualizar foto de perfil'] });
    }
};