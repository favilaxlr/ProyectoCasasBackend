import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import { v2 as cloudinary } from 'cloudinary';
import { 
    sanitizeCityCodes, 
    MAX_NOTIFICATION_CITIES, 
    MIN_NOTIFICATION_CITIES,
    isValidCityCode,
    USER_NOTIFICATION_CITY_COOLDOWN_MS
} from '../config/notificationCities.js';

const attachNotificationMetadata = (userDoc) => {
    if (!userDoc) return userDoc;
    const plainUser = typeof userDoc.toObject === 'function'
        ? userDoc.toObject({ virtuals: true })
        : userDoc;

    const prefs = plainUser.notificationPreferences || {};
    const lastUserUpdate = prefs.userLastUpdatedAt ? new Date(prefs.userLastUpdatedAt) : null;
    const nextUserUpdateAvailableAt = lastUserUpdate
        ? new Date(lastUserUpdate.getTime() + USER_NOTIFICATION_CITY_COOLDOWN_MS)
        : null;

    return {
        ...plainUser,
        notificationPreferences: {
            ...prefs,
            nextUserUpdateAvailableAt
        }
    };
};

// Obtener todos los usuarios (solo admin)
export const getUsers = async (req, res) => {
    try {
        const users = await User.find()
            .populate('role', 'role')
            .populate('notificationPreferences.lastUpdatedBy', 'username email')
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.json(users.map(attachNotificationMetadata));
    } catch (error) {
        res.status(500).json({ message: ['Error al obtener usuarios'] });
    }
};

// Obtener un usuario por ID
export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('role', 'role')
            .populate('notificationPreferences.lastUpdatedBy', 'username email')
            .select('-password');
        
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json(attachNotificationMetadata(user));
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
        )
        .populate('role', 'role')
        .populate('notificationPreferences.lastUpdatedBy', 'username email')
        .select('-password');
        
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json({ message: 'Rol actualizado correctamente', user: attachNotificationMetadata(user) });
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
        )
        .populate('role', 'role')
        .populate('notificationPreferences.lastUpdatedBy', 'username email')
        .select('-password');
        
        if (!updatedUser) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }
        
        res.json({ message: 'Perfil actualizado correctamente', user: attachNotificationMetadata(updatedUser) });
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
            .populate('notificationPreferences.lastUpdatedBy', 'username email')
            .select('-password');
        
        res.json({ message: 'Foto de perfil actualizada correctamente', user: attachNotificationMetadata(updatedUser) });
    } catch (error) {
        res.status(500).json({ message: ['Error al actualizar foto de perfil'] });
    }
};

export const updateOwnNotificationPreferences = async (req, res) => {
    try {
        const { cities } = req.body;

        if (!Array.isArray(cities)) {
            return res.status(400).json({ message: ['Debes enviar un arreglo de ciudades'] });
        }

        const uniqueCodes = Array.from(new Set(cities.filter(Boolean).map(code => code.toLowerCase())));

        if (uniqueCodes.length < MIN_NOTIFICATION_CITIES) {
            return res.status(400).json({ message: [`Debes seleccionar al menos ${MIN_NOTIFICATION_CITIES} ciudad${MIN_NOTIFICATION_CITIES > 1 ? 'es' : ''}`] });
        }

        if (uniqueCodes.length > MAX_NOTIFICATION_CITIES) {
            return res.status(400).json({ message: [`Solo puedes seleccionar hasta ${MAX_NOTIFICATION_CITIES} ciudades`] });
        }

        const invalidCodes = uniqueCodes.filter(code => !isValidCityCode(code));
        if (invalidCodes.length > 0) {
            return res.status(400).json({ message: ['Una o más ciudades no son válidas'] });
        }

        const sanitized = sanitizeCityCodes(uniqueCodes);

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }

        const lastUserUpdateRaw = user.notificationPreferences?.userLastUpdatedAt;
        if (lastUserUpdateRaw) {
            const lastUserUpdate = new Date(lastUserUpdateRaw);
            const elapsed = Date.now() - lastUserUpdate.getTime();
            if (elapsed < USER_NOTIFICATION_CITY_COOLDOWN_MS) {
                const nextAllowed = new Date(lastUserUpdate.getTime() + USER_NOTIFICATION_CITY_COOLDOWN_MS);
                return res.status(429).json({
                    message: ['Solo puedes actualizar tus ciudades una vez por semana.'],
                    nextAllowedUpdate: nextAllowed
                });
            }
        }

        const now = new Date();
        user.notificationPreferences = {
            ...(user.notificationPreferences || {}),
            cities: sanitized,
            lastUpdatedBy: req.user.id,
            lastUpdatedAt: now,
            userLastUpdatedAt: now
        };

        await user.save();

        const populatedUser = await User.findById(req.user.id)
            .populate('role', 'role')
            .populate('notificationPreferences.lastUpdatedBy', 'username email')
            .select('-password');

        res.json({
            message: 'Preferencias de notificación actualizadas',
            user: attachNotificationMetadata(populatedUser)
        });
    } catch (error) {
        console.error('Error al actualizar preferencias de notificación del usuario:', error);
        res.status(500).json({ message: ['Error al actualizar preferencias de notificación'] });
    }
};

export const updateUserNotificationPreferences = async (req, res) => {
    try {
        const { cities } = req.body;

        if (!Array.isArray(cities)) {
            return res.status(400).json({ message: ['Debes enviar un arreglo de ciudades'] });
        }

        const uniqueCodes = Array.from(new Set(cities.filter(Boolean).map(code => code.toLowerCase())));

        if (uniqueCodes.length > MAX_NOTIFICATION_CITIES) {
            return res.status(400).json({ message: [`Solo puedes asignar hasta ${MAX_NOTIFICATION_CITIES} ciudades`] });
        }

        const invalidCodes = uniqueCodes.filter(code => !isValidCityCode(code));
        if (invalidCodes.length > 0) {
            return res.status(400).json({ message: ['Una o más ciudades no son válidas'] });
        }

        const sanitized = sanitizeCityCodes(uniqueCodes);

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: ['Usuario no encontrado'] });
        }

        const previousUserLastUpdatedAt = user.notificationPreferences?.userLastUpdatedAt || null;

        user.notificationPreferences = {
            ...(user.notificationPreferences || {}),
            cities: sanitized,
            lastUpdatedBy: req.user.id,
            lastUpdatedAt: new Date(),
            userLastUpdatedAt: previousUserLastUpdatedAt
        };

        await user.save();

        const populatedUser = await User.findById(user._id)
            .populate('role', 'role')
            .populate('notificationPreferences.lastUpdatedBy', 'username email')
            .select('-password');

        res.json({
            message: 'Preferencias de notificación actualizadas',
            user: attachNotificationMetadata(populatedUser)
        });
    } catch (error) {
        console.error('Error al actualizar preferencias de notificación:', error);
        res.status(500).json({ message: ['Error al actualizar preferencias de notificación'] });
    }
};