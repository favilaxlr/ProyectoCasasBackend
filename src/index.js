import 'dotenv/config';
import app from './app.js'
import { connectDB } from './db.js';
import {v2 as cloudinary} from 'cloudinary';

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

        // Iniciar servidor solo después de conectar a MongoDB
        app.listen(4000, () => {
            console.log("Servidor corriendo en el puerto 4000");
        });
    } catch (error) {
        console.error("Error al iniciar el servidor:", error);
        process.exit(1);
    }
}

startServer();