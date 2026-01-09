import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors' ;
import dotenv from 'dotenv';


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

const app= express();

app.use(cors({
    origin: [
        process.env.BASE_URL_FRONTEND,
        process.env.BASE_URL_BACKEND,
        'http://192.168.1.79:5173', // IP de red local para acceso desde móvil
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/ // Permite cualquier IP local en el rango 192.168.x.x
    ],
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());//Cookie en formto Json
//Recibir imagenes en el req.body
app.use(express.urlencoded({extended: true})); //Importante para webhooks de Twilio

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

export default app;