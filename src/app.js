import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csurf';


//Configuramos la lectura de las variables de entorno
dotenv.config();

//Importamos las rutas para usuarios
import authRoutes from './routes/auth.routes.js'

//Importamos las nuevas rutas para propiedades
import propertyRoutes from './routes/properties.routes.js';
//Importamos las rutas para citas
import appointmentRoutes from './routes/appointments.routes.js';
//Importamos las rutas para gestión de usuarios
import userRoutes from './routes/users.routes.js';
//Importamos las rutas para reseñas
import reviewRoutes from './routes/reviews.routes.js';
//Importamos las rutas para notificaciones
import notificationRoutes from './routes/notifications.routes.js';
//Importamos las rutas para ofertas
import offerRoutes from './routes/offers.routes.js';

const app = express();
const isLocalEnv = process.env.ENVIROMENT === 'local';

app.set('trust proxy', 1);

const corsOptions = {
    origin: [
        process.env.BASE_URL_FRONTEND,
        process.env.BASE_URL_BACKEND,
        'http://192.168.1.79:5173', // IP de red local para acceso desde móvil
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/ // Permite cualquier IP local en el rango 192.168.x.x
    ],
    credentials: true
};

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: ['Demasiadas peticiones detectadas. Intenta nuevamente más tarde.'] }
});

const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: ['Demasiados intentos detectados. Espera antes de intentarlo de nuevo.'] }
});

const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        sameSite: isLocalEnv ? 'lax' : 'none',
        secure: !isLocalEnv
    }
});

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser()); // Cookie en formato JSON
// Recibir imágenes en el req.body (p.ej. webhooks de Twilio)
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/verify-code', authLimiter);
app.use('/api/resend-code', authLimiter);
app.use(csrfProtection);

app.get('/api/csrf-token', (req, res) => {
    res.status(200).json({ csrfToken: req.csrfToken() });
});

//Indicamos al servidor que utilice las rutas del objeto authRoutes
app.use('/api/', authRoutes);

//Nuevas rutas para el sistema inmobiliario
app.use('/api/', propertyRoutes);
app.use('/api/', appointmentRoutes);
app.use('/api/admin/', userRoutes);
app.use('/api/', reviewRoutes);
app.use('/api/admin/', notificationRoutes);
app.use('/api/', offerRoutes);

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Manejador global de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ message: ['Token CSRF inválido o expirado. Recarga la página e inténtalo nuevamente.'] });
    }

    console.error('Unhandled error', err);
    return res.status(err.status || 500).json({ message: ['Error interno del servidor'] });
});

export default app;