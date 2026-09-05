import multer from 'multer';
import cloudinary from 'cloudinary';

const uploadBufferToCloudinary = (file, folder) => new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
            if (error) return reject(error);
            resolve({
                path: result.secure_url,
                filename: result.public_id
            });
        }
    );
    stream.end(file.buffer);
});

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

            try {
                req.files = await Promise.all(
                    req.files.map((file) => uploadBufferToCloudinary(file, 'properties'))
                );
                next();
            } catch (uploadError) {
                console.error('Error uploading property images to Cloudinary:', uploadError);
                return res.status(500).json({ message: ['Error uploading images. Please try again.'] });
            }
        });
    } catch (error) {
        return res.status(400).json({ message: [error.message] });
    }
};

// Middleware para imágenes opcionales (para reseñas)
const createOptionalUploader = (folder) => async (req, res, next) => {
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

            try {
                req.files = await Promise.all(
                    req.files.map((file) => uploadBufferToCloudinary(file, folder))
                );
                next();
            } catch (uploadError) {
                console.error('Error uploading optional images to Cloudinary:', uploadError);
                return res.status(500).json({ message: ['Error uploading images'] });
            }
        });
    } catch (error) {
        return res.status(400).json({ message: [error.message] });
    }
};

// Middleware para imágenes opcionales (para reseñas)
export const uploadOptionalToCloudinary = createOptionalUploader('reviews');

export const uploadListingRequestImages = createOptionalUploader('listing-requests');

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