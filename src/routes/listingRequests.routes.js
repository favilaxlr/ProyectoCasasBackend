import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authRequired } from '../middlewares/validateToken.js';
import { optionalAuth } from '../middlewares/optionalAuth.js';
import { isAdminOrCoAdmin } from '../middlewares/isAdminOrCoAdmin.js';
import { uploadListingRequestImages } from '../middlewares/uploadImage.js';
import { validateSchema } from '../middlewares/validateSchemas.js';
import {
    listingRequestSchema,
    listingRequestStatusSchema
} from '../schemas/listingRequest.schemas.js';
import {
    createListingRequest,
    getListingRequests,
    getListingRequest,
    updateListingRequestStatus
} from '../controllers/listingRequests.controller.js';

const router = Router();

const createListingRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: ['Too many sell requests. Please try again later.'] }
});

router.post(
    '/listing-requests',
    createListingRequestLimiter,
    optionalAuth,
    uploadListingRequestImages,
    validateSchema(listingRequestSchema),
    createListingRequest
);

router.get(
    '/listing-requests',
    authRequired,
    isAdminOrCoAdmin,
    getListingRequests
);

router.get(
    '/listing-requests/:id',
    authRequired,
    isAdminOrCoAdmin,
    getListingRequest
);

router.put(
    '/listing-requests/:id/status',
    authRequired,
    isAdminOrCoAdmin,
    validateSchema(listingRequestStatusSchema),
    updateListingRequestStatus
);

export default router;
