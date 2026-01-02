import multer from 'multer';
import cloudinary from 'cloudinary';

// Configuración de multer para documentos
const storage = multer.memoryStorage();
const uploadDocuments = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB por archivo
        files: 5 // Máximo 5 documentos
    }
}).array('documents', 5);

export const uploadDocumentsToCloudinary = async (req, res, next) => {
    const allowedMimes = [
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];
    
    try {
        uploadDocuments(req, res, async (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: ['File size exceeded (max 10MB per file)'] });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ message: ['Maximum 5 documents allowed'] });
                }
                return res.status(400).json({ message: [err.message] });
            }

            if (!req.files || req.files.length === 0) {
                // Si no hay documentos, continuar sin error (es opcional)
                return next();
            }

            // Validar tipos de archivo
            for (const file of req.files) {
                if (!allowedMimes.includes(file.mimetype)) {
                    return res.status(400).json({ 
                        message: [`File type not allowed: ${file.mimetype}. Only PDF and Word documents are allowed.`] 
                    });
                }
            }

            // Subir todos los documentos a Cloudinary
            const uploadedDocuments = [];
            
            for (const file of req.files) {
                try {
                    const result = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.v2.uploader.upload_stream(
                            {
                                folder: 'property-documents',
                                resource_type: 'raw', // Para documentos no-imagen
                                public_id: `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        uploadStream.end(file.buffer);
                    });

                    uploadedDocuments.push({
                        url: result.secure_url,
                        publicId: result.public_id,
                        fileName: file.originalname,
                        fileType: file.mimetype,
                        fileSize: file.size
                    });
                } catch (uploadError) {
                    console.error('Error uploading document to Cloudinary:', uploadError);
                    return res.status(500).json({ 
                        message: [`Error uploading document: ${file.originalname}`] 
                    });
                }
            }

            req.uploadedDocuments = uploadedDocuments;
            next();
        });
    } catch (error) {
        console.error('Error in document upload middleware:', error);
        return res.status(500).json({ message: ['Error processing documents'] });
    }
};

// Middleware para eliminar un documento de Cloudinary
export const deleteDocumentFromCloudinary = async (publicId) => {
    try {
        await cloudinary.v2.uploader.destroy(publicId, { resource_type: 'raw' });
        return true;
    } catch (error) {
        console.error('Error deleting document from Cloudinary:', error);
        return false;
    }
};
