import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const resetDatabase = async () => {
    try {
        const url = process.env.MONGODB_URL;
        console.log('Conectando a MongoDB...');
        await mongoose.connect(url);
        console.log('✅ Conectado a MongoDB');
        
        console.log('🗑️  Eliminando base de datos...');
        await mongoose.connection.dropDatabase();
        console.log('✅ Base de datos eliminada exitosamente');
        
        await mongoose.connection.close();
        console.log('✅ Conexión cerrada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

resetDatabase();
