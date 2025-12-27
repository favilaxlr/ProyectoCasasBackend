import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const clearAppointments = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('📦 Conectado a MongoDB');
        
        const result = await mongoose.connection.collection('appointments').deleteMany({});
        console.log(`🗑️  ${result.deletedCount} citas eliminadas`);
        
        await mongoose.disconnect();
        console.log('✅ Base de datos limpiada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

clearAppointments();
