import multer from 'multer';
import cloudinary from 'cloudinary';
import { Readable } from 'stream';

const storage = multer.memoryStorage();
const uploadVideos = multer({
    storage,
    limits: {
        fileSize: 80 * 1024 * 1024, // 80MB por archivo
        files: 3
    }
}).array('videos', 3);

const allowedMimes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/mpeg'
];

const bufferToStream = (buffer) => {
    const readable = new Readable({
        read() {
            this.push(buffer);
            this.push(null);
        }
    });
    return readable;
};

export const uploadVideosToCloudinary = async (req, res, next) => {
    try {
        uploadVideos(req, res, async (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: ['Video size exceeded (max 80MB per file)'] });
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ message: ['Maximum 3 videos allowed per upload'] });
                }
                return res.status(400).json({ message: [err.message] });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: ['No videos uploaded'] });
            }

            for (const file of req.files) {
                if (!allowedMimes.includes(file.mimetype)) {
                    return res.status(400).json({
                        message: [`File type not allowed: ${file.mimetype}. Use MP4, MOV, AVI, MPEG or WebM.`]
                    });
                }
            }

            try {
                const uploadPromises = req.files.map((file) =>
                    new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.v2.uploader.upload_stream(
                            {
                                folder: 'property-videos',
                                resource_type: 'video',
                                eager: [{
                                    format: 'jpg',
                                    transformation: {
                                        width: 640,
                                        height: 360,
                                        crop: 'fill',
                                        gravity: 'auto'
                                    }
                                }],
                                eager_async: false
                            },
                            (error, result) => {
                                if (error) {
                                    return reject(error);
                                }

                                const thumbnailUrl = cloudinary.v2.url(result.public_id, {
                                    resource_type: 'video',
                                    format: 'jpg',
                                    transformation: [{
                                        width: 640,
                                        height: 360,
                                        crop: 'fill',
                                        gravity: 'auto'
                                    }]
                                });

                                resolve({
                                    url: result.secure_url,
                                    publicId: result.public_id,
                                    duration: result.duration,
                                    format: result.format,
                                    bytes: result.bytes,
                                    thumbnailUrl
                                });
                            }
                        );

                        bufferToStream(file.buffer).pipe(uploadStream);
                    })
                );

                req.uploadedVideos = await Promise.all(uploadPromises);
                next();
            } catch (uploadError) {
                console.error('Error uploading videos:', uploadError);
                return res.status(500).json({ message: ['Error uploading videos'] });
            }
        });
    } catch (error) {
        console.error('Video upload middleware error:', error);
        return res.status(500).json({ message: ['Error processing videos'] });
    }
};
