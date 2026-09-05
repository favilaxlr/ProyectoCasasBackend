import dotenv from 'dotenv';
import { connectDB } from '../db.js';
import mongoose from 'mongoose';
import Role from '../models/roles.models.js';
import User from '../models/user.models.js';

dotenv.config();

const LOCAL_USERS = [
    {
        username: 'admin',
        email: 'admin@admin.com',
        phone: '+15550000001',
        password: 'admin123',
        roleName: 'admin'
    },
    {
        username: 'coadmin',
        email: 'coadmin@admin.com',
        phone: '+15550000002',
        password: 'coadmin123',
        roleName: 'co-admin'
    },
    {
        username: 'user',
        email: 'user@test.com',
        phone: '+15550000003',
        password: 'user123',
        roleName: 'user'
    }
];

const ROLE_NAMES = ['admin', 'co-admin', 'user'];

async function ensureRoles() {
    const existing = await Role.find({});
    const existingNames = new Set(existing.map((role) => role.role));

    for (const name of ROLE_NAMES) {
        if (!existingNames.has(name)) {
            await new Role({ role: name }).save();
            console.log(`  ✓ Rol creado: ${name}`);
        } else {
            console.log(`  • Rol ya existía: ${name}`);
        }
    }

    const roles = await Role.find({});
    return Object.fromEntries(roles.map((role) => [role.role, role._id]));
}

async function seedLocalUsers() {
    try {
        await connectDB();
        console.log('\n👥 Roles...');
        const roleMap = await ensureRoles();

        console.log('\n👤 Usuarios de prueba...');
        for (const data of LOCAL_USERS) {
            const roleId = roleMap[data.roleName];
            if (!roleId) {
                throw new Error(`No se encontró el rol ${data.roleName}`);
            }

            const existing = await User.findOne({
                $or: [{ email: data.email }, { username: data.username }]
            });

            if (existing) {
                existing.username = data.username;
                existing.email = data.email;
                existing.phone = data.phone;
                existing.password = data.password;
                existing.role = roleId;
                existing.isEmailVerified = true;
                existing.isPhoneVerified = true;
                existing.notificationPreferences = {
                    ...(existing.notificationPreferences || {}),
                    cities: existing.notificationPreferences?.cities?.length
                        ? existing.notificationPreferences.cities
                        : ['dallas-texas']
                };
                await existing.save();
                console.log(`  ✓ Actualizado: ${data.username} (${data.roleName})`);
            } else {
                await new User({
                    username: data.username,
                    email: data.email,
                    phone: data.phone,
                    password: data.password,
                    role: roleId,
                    isEmailVerified: true,
                    isPhoneVerified: true,
                    notificationPreferences: {
                        cities: ['dallas-texas']
                    }
                }).save();
                console.log(`  ✓ Creado: ${data.username} (${data.roleName})`);
            }
        }

        console.log('\n✅ Base local lista. Credenciales:');
        console.log('  Admin     email: admin@admin.com     password: admin123');
        console.log('  Co-Admin  email: coadmin@admin.com   password: coadmin123');
        console.log('  User      email: user@test.com       password: user123');
    } catch (error) {
        console.error('❌ Error al crear usuarios locales:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
    }
}

seedLocalUsers();
