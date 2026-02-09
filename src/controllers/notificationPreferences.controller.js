import { 
    MAX_NOTIFICATION_CITIES, 
    MIN_NOTIFICATION_CITIES,
    USER_NOTIFICATION_CITY_COOLDOWN_DAYS,
    NOTIFICATION_CITIES 
} from '../config/notificationCities.js';

export const getNotificationCities = (_req, res) => {
    res.json({
        minSelection: MIN_NOTIFICATION_CITIES,
        maxSelection: MAX_NOTIFICATION_CITIES,
        cities: NOTIFICATION_CITIES,
        userUpdateCooldownDays: USER_NOTIFICATION_CITY_COOLDOWN_DAYS
    });
};
