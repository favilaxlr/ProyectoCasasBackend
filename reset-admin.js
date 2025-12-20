import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Modelos simples
const roleSchema = new mongoose.Schema({
    role: { type: String, required: true }
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' }
});

const Role = mongoose.model('Role', roleSchema);
const User = mongoose.model('User', userSchema);

async function resetAdmin() {
    try {
        // Conectar a MongoDB
        await mongoose.connect('mongodb://127.0.0.1/frfamilyinvestments');
        console.log('Conectado a MongoDB');

        // Limpiar usuarios y roles existentes
        await User.deleteMany({});
        await Role.deleteMany({});
        console.log('Base de datos limpiada');

        // Crear roles
        const adminRole = new Role({ role: 'admin' });
        const userRole = new Role({ role: 'user' });
        const coAdminRole = new Role({ role: 'co-admin' });
        
        await adminRole.save();
        await userRole.save();
        await coAdminRole.save();
        console.log('Roles creados');

        // Crear usuario admin
        const hashedPassword = await bcrypt.hash('Admin.2025#', 10);
        const adminUser = new User({
            username: 'Admin',
            email: 'admin@admin.com',
            password: hashedPassword,
            role: adminRole._id
        });

        await adminUser.save();
        console.log('Usuario admin creado exitosamente');
        console.log('Username: Admin');
        console.log('Password: Admin.2025#');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetAdmin();