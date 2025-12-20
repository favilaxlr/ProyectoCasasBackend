import 'dotenv/config';
import app from './app.js'
import { connectDB } from './db.js';
import {v2 as cloudinary} from 'cloudinary';

//Configuramos la lectura de variables de entorno
//para conexion con cloudinary


connectDB();

//Configuramos de cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

app.listen(4000);
console.log("Servidor corriendo en el puerto 4000");