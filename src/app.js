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

const app= express();

app.use(cors({
    origin: [
        process.env.BASE_URL_BACKEND,
        process.env.BASE_URL_FRONTEND
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

export default app;