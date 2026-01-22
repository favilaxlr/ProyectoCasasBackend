import multer from 'multer';
import cloudinary from 'cloudinary';
import path from 'path';

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

            const sanitizeFilename = (filename) => filename
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-_.]/g, '');

            const getExtensionParts = (filename) => {
                const ext = path.extname(filename || '').toLowerCase();
                const sanitizedExt = sanitizeFilename(ext);
                const extensionWithoutDot = sanitizedExt.startsWith('.')
                    ? sanitizedExt.slice(1)
                    : sanitizedExt;
                return { sanitizedExt, extensionWithoutDot };
            };

            // Subir todos los documentos a Cloudinary
            const uploadedDocuments = [];
            
            for (const file of req.files) {
                try {
                    const { sanitizedExt, extensionWithoutDot } = getExtensionParts(file.originalname);
                    const isPdf = extensionWithoutDot === 'pdf';
                    const baseName = path.basename(file.originalname, path.extname(file.originalname)) || 'document';
                    const safeBaseName = sanitizeFilename(baseName) || 'document';
                    const uniqueSuffix = Date.now();
                    const publicIdBase = `doc_${safeBaseName}_${uniqueSuffix}`;
                    const publicId = isPdf
                        ? publicIdBase
                        : `${publicIdBase}${sanitizedExt}`;


                    const uploadOptions = {
                        folder: 'property-documents',
                        resource_type: 'auto',
                        public_id: publicId,
                        format: isPdf ? 'pdf' : undefined,
                        type: 'upload'
                    };

                    const result = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.v2.uploader.upload_stream(
                            uploadOptions,
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
export const deleteDocumentFromCloudinary = async (publicId, fileType) => {
    const primaryResource = fileType === 'application/pdf' ? 'image' : 'raw';

    try {
        await cloudinary.v2.uploader.destroy(publicId, { resource_type: primaryResource });
        return true;
    } catch (error) {
        console.error('Error deleting document from Cloudinary:', error);

        // Intentar con el recurso alternativo si falla la primera vez
        if (primaryResource === 'image') {
            try {
                await cloudinary.v2.uploader.destroy(publicId, { resource_type: 'raw' });
                return true;
            } catch (fallbackError) {
                console.error('Fallback delete failed:', fallbackError);
            }
        }
        return false;
    }
};
