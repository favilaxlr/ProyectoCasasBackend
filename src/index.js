import 'dotenv/config';
import app from './app.js'
import { connectDB } from './db.js';
import {v2 as cloudinary} from 'cloudinary';
import { startReminderCron } from './services/appointmentReminderService.js';

//Configuramos la lectura de variables de entorno
//para conexion con cloudinary

// Función async para iniciar el servidor
async function startServer() {
    try {
        // Esperar a que MongoDB se conecte
        await connectDB();
        
        //Configuramos de cloudinary
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        // Iniciar servicio de recordatorios de citas
        startReminderCron();

        // Iniciar servidor solo después de conectar a MongoDB
        const PORT = process.env.PORT || 4000;
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en el puerto ${PORT}`);
        });
    } catch (error) {
        console.error("Error al iniciar el servidor:", error);
        process.exit(1);
    }
}

startServer();