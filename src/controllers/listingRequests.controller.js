import mongoose from 'mongoose';
import ListingRequest from '../models/listingRequest.models.js';
import { sendListingRequestNotification } from '../services/listingRequestEmail.js';

const VALID_STATUSES = ['pending', 'contacted', 'closed'];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const parseImages = (files = []) => files.map((file) => ({
    url: file.path,
    publicId: file.filename
}));

export const createListingRequest = async (req, res) => {
    try {
        const {
            fullName,
            phone,
            email,
            location,
            propertyType,
            estimatedPrice,
            squareFeet,
            lotSquareFeet,
            description,
            aceptaPrivacidad
        } = req.body;

        const toOptionalNumber = (value) => (
            value === '' || value === undefined || value === null ? undefined : Number(value)
        );

        const listingRequest = new ListingRequest({
            fullName,
            phone,
            email,
            location,
            propertyType,
            estimatedPrice: toOptionalNumber(estimatedPrice),
            squareFeet: toOptionalNumber(squareFeet),
            lotSquareFeet: toOptionalNumber(lotSquareFeet),
            description,
            images: parseImages(req.files),
            aceptaPrivacidad: aceptaPrivacidad === true || aceptaPrivacidad === 'true' || aceptaPrivacidad === 'on',
            user: req.user?.id || null
        });

        const saved = await listingRequest.save();

        const emailResult = await sendListingRequestNotification(saved);
        if (!emailResult.success) {
            console.error('Listing request saved, but email notification failed:', emailResult.error);
        }

        res.status(201).json(saved);
    } catch (error) {
        console.error('Error creating listing request:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((err) => err.message);
            return res.status(400).json({ message: messages });
        }

        res.status(500).json({ message: ['Error creating listing request'] });
    }
};

export const getListingRequests = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) {
            if (!VALID_STATUSES.includes(req.query.status)) {
                return res.status(400).json({ message: ['Invalid status filter'] });
            }
            filter.status = req.query.status;
        }

        const requests = await ListingRequest.find(filter)
            .populate('user', 'username email phone')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        console.error('Error fetching listing requests:', error);
        res.status(500).json({ message: ['Error fetching listing requests'] });
    }
};

export const getListingRequest = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).json({ message: ['Listing request not found'] });
        }

        const request = await ListingRequest.findById(req.params.id)
            .populate('user', 'username email phone');

        if (!request) {
            return res.status(404).json({ message: ['Listing request not found'] });
        }

        res.json(request);
    } catch (error) {
        console.error('Error fetching listing request:', error);
        res.status(500).json({ message: ['Error fetching listing request'] });
    }
};

export const updateListingRequestStatus = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).json({ message: ['Listing request not found'] });
        }

        const { status } = req.body;

        const request = await ListingRequest.findByIdAndUpdate(            req.params.id,
            { status },
            { new: true, runValidators: true }
        ).populate('user', 'username email phone');

        if (!request) {
            return res.status(404).json({ message: ['Listing request not found'] });
        }

        res.json(request);
    } catch (error) {
        console.error('Error updating listing request:', error);
        res.status(500).json({ message: ['Error updating listing request'] });
    }
};
