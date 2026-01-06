import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { isAdminOrCoAdmin } from '../middlewares/isAdminOrCoAdmin.js';
import { isNotCoAdmin } from '../middlewares/isNotCoAdmin.js';
import { validateSchema } from '../middlewares/validateSchemas.js';

import {
    createAppointment,
    getAppointments,
    getAppointment,
    confirmAppointment,
    confirmAppointmentBySMS,
    confirmAppointmentByLink,
    assignAppointment,
    sendAppointmentReminders,
    twilioWebhook,
    cancelAppointment,
    getAvailableSlots,
    getUserAppointments,
    completeAppointment,
    deleteAllAppointments
} from '../controllers/appointments.controller.js';

// Importamos los schemas de validación
import { appointmentSchema, confirmAppointmentSchema } from '../schemas/appointment.schemas.js';

const router = Router();

// Rutas públicas
router.get('/appointments/confirm/:id/:code', confirmAppointmentByLink); // Confirmar por link (UN CLIC)
router.post('/appointments/webhook/sms', twilioWebhook); // Webhook de Twilio
router.get('/appointments/available-slots', getAvailableSlots); // Horarios disponibles
router.post('/appointments/confirm-sms', confirmAppointmentBySMS); // Confirmar por SMS (manual)

// Rutas para usuarios registrados (NO co-admin)
router.post('/appointments', authRequired, isNotCoAdmin, validateSchema(appointmentSchema), createAppointment); // Crear cita
router.get('/my-appointments', authRequired, getUserAppointments); // Mis citas

// Rutas administrativas (requieren autenticación y ser admin o co-admin)
router.get('/appointments', authRequired, isAdminOrCoAdmin, getAppointments); // Ver todas las citas
router.get('/appointments/:id', authRequired, isAdminOrCoAdmin, getAppointment); // Ver cita específica
router.put('/appointments/:id/assign', authRequired, isAdminOrCoAdmin, assignAppointment); // Asignarme cita
router.put('/appointments/:id/confirm', authRequired, isAdminOrCoAdmin, confirmAppointment); // Confirmar cita
router.put('/appointments/:id/complete', authRequired, isAdminOrCoAdmin, completeAppointment); // Completar cita
router.put('/appointments/:id/cancel', authRequired, isAdminOrCoAdmin, cancelAppointment); // Cancelar cita
router.post('/appointments/reminders', authRequired, isAdmin, sendAppointmentReminders); // Enviar recordatorios (solo admin)
router.delete('/appointments/clear-all', authRequired, isAdmin, deleteAllAppointments); // Borrar todas las citas (solo admin)

export default router;