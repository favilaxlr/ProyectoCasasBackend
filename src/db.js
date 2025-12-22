import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        const url = process.env.MONGODB_URL;
        
        // Opciones de conexión para evitar warnings y timeouts
        const options = {
            serverSelectionTimeoutMS: 5000, // Timeout después de 5s
            socketTimeoutMS: 45000, // Close sockets after 45s
        };
        
        await mongoose.connect(url, options);
        console.log("✅ Base de datos conectada: " + url);
    } catch (error) {
        console.error("❌ Error al conectarse a MongoDB:");
        console.error(error.message);
        throw error; // Re-lanzar el error para que lo maneje index.js
    }
};

// Manejar eventos de conexión
mongoose.connection.on('connected', () => {
    console.log('📊 Mongoose conectado a MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Error de conexión Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose desconectado de MongoDB');
});