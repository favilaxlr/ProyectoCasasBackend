import Review from '../models/review.models.js';
import Property from '../models/property.models.js';
import Appointment from '../models/appointment.models.js';
import { v2 as cloudinary } from 'cloudinary';

// Crear nueva reseña (solo usuarios registrados)
export const createReview = async (req, res) => {
    try {
        const { propertyId, rating, subcategories, comment, recommendation } = req.body;
        
        // Verificar que la propiedad existe
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ message: ['Propiedad no encontrada'] });
        }

        // Verificar que no haya reseñado antes esta propiedad
        const existingReview = await Review.findOne({
            property: propertyId,
            user: req.user.id
        });

        if (existingReview) {
            return res.status(400).json({ 
                message: ['Ya has reseñado esta propiedad'] 
            });
        }

        // Procesar imágenes si existen
        let images = [];
        if (req.files && req.files.length > 0) {
            const maxImages = Math.min(req.files.length, 5);
            images = req.files.slice(0, maxImages).map(file => ({
                url: file.path,
                publicId: file.filename,
                caption: ''
            }));
        }

        const newReview = new Review({
            property: propertyId,
            user: req.user.id,
            rating,
            subcategories,
            comment,
            images,
            recommendation: recommendation === 'true'
        });

        const savedReview = await newReview.save();
        res.json(savedReview);
    } catch (error) {
        res.status(500).json({ message: ['Error al crear reseña'] });
    }
};

// Obtener reseñas de una propiedad (público - solo aprobadas)
export const getPropertyReviews = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { page = 1, limit = 5, sortBy = 'createdAt' } = req.query;

        const reviews = await Review.find({
            property: propertyId,
            status: 'approved'
        })
        .populate('user', 'username')
        .sort({ featured: -1, [sortBy]: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        const total = await Review.countDocuments({
            property: propertyId,
            status: 'approved'
        });

        // Calcular estadísticas
        const stats = await Review.aggregate([
            { $match: { property: propertyId, status: 'approved' } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratingDistribution: {
                        $push: '$rating'
                    }
                }
            }
        ]);

        res.json({
            reviews,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            },
            stats: stats[0] || { averageRating: 0, totalReviews: 0 }
        });
    } catch (error) {
        res.status(500).json({ message: ['Error al obtener reseñas'] });
    }
};

// Obtener reseñas pendientes de moderación (admin/co-admin)
export const getPendingReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ status: 'pending' })
            .populate('user', 'username email')
            .populate('property', 'title')
            .sort({ createdAt: -1 });

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: ['Error al obtener reseñas pendientes'] });
    }
};

// Moderar reseña (admin/co-admin)
export const moderateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, moderationNotes } = req.body; // action: 'approve', 'reject', 'request_changes'

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ message: ['Reseña no encontrada'] });
        }

        const statusMap = {
            'approve': 'approved',
            'reject': 'rejected',
            'request_changes': 'changes_requested'
        };

        review.status = statusMap[action];
        review.moderationNotes = moderationNotes;
        review.moderatedBy = req.user.id;
        review.moderatedAt = new Date();

        await review.save();

        // Si se aprueba, recalcular promedio de la propiedad
        if (action === 'approve') {
            await updatePropertyRating(review.property);
        }

        res.json({ message: `Reseña ${action === 'approve' ? 'aprobada' : action === 'reject' ? 'rechazada' : 'marcada para cambios'}`, review });
    } catch (error) {
        res.status(500).json({ message: ['Error al moderar reseña'] });
    }
};

// Destacar/quitar destaque de reseña (solo admin)
export const toggleFeaturedReview = async (req, res) => {
    try {
        const { id } = req.params;
        
        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ message: ['Reseña no encontrada'] });
        }

        review.featured = !review.featured;
        await review.save();

        res.json({ 
            message: review.featured ? 'Reseña destacada' : 'Reseña no destacada', 
            review 
        });
    } catch (error) {
        res.status(500).json({ message: ['Error al cambiar estado destacado'] });
    }
};

// Votar reseña como útil (usuarios registrados)
export const voteHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        
        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ message: ['Reseña no encontrada'] });
        }

        // Verificar si ya votó
        const existingVote = review.helpfulVotes.find(vote => 
            vote.user.toString() === req.user.id
        );

        if (existingVote) {
            // Remover voto
            review.helpfulVotes = review.helpfulVotes.filter(vote => 
                vote.user.toString() !== req.user.id
            );
        } else {
            // Agregar voto
            review.helpfulVotes.push({
                user: req.user.id,
                votedAt: new Date()
            });
        }

        review.helpfulCount = review.helpfulVotes.length;
        await review.save();

        res.json({ 
            message: existingVote ? 'Voto removido' : 'Voto agregado',
            helpfulCount: review.helpfulCount
        });
    } catch (error) {
        res.status(500).json({ message: ['Error al votar reseña'] });
    }
};

// Función auxiliar para actualizar rating promedio de propiedad
const updatePropertyRating = async (propertyId) => {
    try {
        const stats = await Review.aggregate([
            { $match: { property: propertyId, status: 'approved' } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        if (stats.length > 0) {
            await Property.findByIdAndUpdate(propertyId, {
                'rating.average': Math.round(stats[0].averageRating * 10) / 10,
                'rating.count': stats[0].totalReviews
            });
        }
    } catch (error) {
        console.log('Error updating property rating:', error);
    }
};

// Eliminar reseña (admin/co-admin)
export const deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        
        if (!review) {
            return res.status(404).json({ message: ['Reseña no encontrada'] });
        }

        // Eliminar imágenes de Cloudinary si las tiene
        if (review.images && review.images.length > 0) {
            for (const image of review.images) {
                if (image.publicId) {
                    try {
                        await cloudinary.uploader.destroy(image.publicId);
                    } catch (error) {
                        console.log('Error deleting image from cloudinary:', error);
                    }
                }
            }
        }

        await Review.findByIdAndDelete(req.params.id);
        
        // Actualizar rating de la propiedad
        await updatePropertyRating(review.property);
        
        res.json({ message: ['Reseña eliminada correctamente'] });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ message: ['Error al eliminar la reseña'] });
    }
};