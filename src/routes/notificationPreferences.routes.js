import { Router } from 'express';
import { getNotificationCities } from '../controllers/notificationPreferences.controller.js';

const router = Router();

router.get('/notification-cities', getNotificationCities);

export default router;
