import multer from 'multer';
import cloudinary from 'cloudinary';

//Configuración de multer
//multer recupera la imagen del request y la carga en memoria local
const storage = multer.memoryStorage();
const uploadSingle = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024//5MB
    }
}).single('image');

const uploadMultiple = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,//5MB por archivo
        files: 10 // Máximo 10 archivos
    }
}).array('images', 10); // 'images' es el nombre del campo, 10 es el máximo

export const uploadToCloudinary = async (req, res, next) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    try {
        uploadMultiple(req, res, async (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: ['Tamaño del archivo excedido'] });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ message: ['Máximo 10 imágenes permitidas'] });
                }
                return res.status(400).json({ message: [err.message] });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: ['No se encontraron imágenes'] });
            }

            // Validar tipos de archivo
            for (const file of req.files) {
                if (!allowedMimes.includes(file.mimetype)) {
                    return res.status(400).json({ 
                        message: [`Tipo de archivo no permitido: ${file.mimetype}`] 
                    });
                }
            }

            // Subir todas las imágenes a Cloudinary
            const uploadPromises = req.files.map(async (file) => {
                const base64Image = Buffer.from(file.buffer).toString('base64');
                const dataUri = `data:${file.mimetype};base64,${base64Image}`;
                
                const uploadResponse = await cloudinary.v2.uploader.upload(dataUri, {
                    folder: 'properties' // Organizar en carpeta
                });
                
                return {
                    path: uploadResponse.secure_url,
                    filename: uploadResponse.public_id
                };
            });

            req.files = await Promise.all(uploadPromises);
            next();
        });
    } catch (error) {
        return res.status(400).json({ message: [error.message] });
    }
};

// Middleware para imágenes opcionales (para reseñas)
export const uploadOptionalToCloudinary = async (req, res, next) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    try {
        uploadMultiple(req, res, async (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: ['Tamaño del archivo excedido'] });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ message: ['Máximo 10 imágenes permitidas'] });
                }
                return res.status(400).json({ message: [err.message] });
            }

            // Si no hay archivos, continuar sin error (opcional)
            if (!req.files || req.files.length === 0) {
                req.files = [];
                return next();
            }

            // Validar tipos de archivo
            for (const file of req.files) {
                if (!allowedMimes.includes(file.mimetype)) {
                    return res.status(400).json({ 
                        message: [`Tipo de archivo no permitido: ${file.mimetype}`] 
                    });
                }
            }

            // Subir todas las imágenes a Cloudinary
            const uploadPromises = req.files.map(async (file) => {
                const base64Image = Buffer.from(file.buffer).toString('base64');
                const dataUri = `data:${file.mimetype};base64,${base64Image}`;
                
                const uploadResponse = await cloudinary.v2.uploader.upload(dataUri, {
                    folder: 'reviews' // Organizar en carpeta de reviews
                });
                
                return {
                    path: uploadResponse.secure_url,
                    filename: uploadResponse.public_id
                };
            });

            req.files = await Promise.all(uploadPromises);
            next();
        });
    } catch (error) {
        return res.status(400).json({ message: [error.message] });
    }
};

// Middleware para imagen única (compatibilidad)
export const uploadSingleToCloudinary = async (req, res, next) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    try {
        uploadSingle(req, res, async (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: ['Tamaño del archivo excedido'] });
                }
                return res.status(400).json({ message: [err.message] });
            }

            if (!req.file) {
                return res.status(400).json({ message: ['Imagen no encontrada'] });
            }

            if (!allowedMimes.includes(req.file.mimetype)) {
                return res.status(400).json({ message: ['Tipo de archivo no permitido'] });
            }

            try {
                const base64Image = Buffer.from(req.file.buffer).toString('base64');
                const dataUri = `data:${req.file.mimetype};base64,${base64Image}`;
                
                const uploadResponse = await cloudinary.v2.uploader.upload(dataUri, {
                    folder: 'profile-images'
                });
                
                req.urlImage = uploadResponse.secure_url;
                req.publicId = uploadResponse.public_id;
                next();
            } catch (uploadError) {
                console.error('Error subiendo a Cloudinary:', uploadError);
                return res.status(500).json({ message: ['Error al subir la imagen a Cloudinary'] });
            }
        });
    } catch (error) {
        console.error('Error en middleware uploadSingleToCloudinary:', error);
        return res.status(500).json({ message: ['Error al procesar la imagen'] });
    }
};