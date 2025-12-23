import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import User from '../models/user.models.js';
import Property from '../models/property.models.js';
import Role from '../models/roles.models.js';

config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/frfamilyinvestments';

// Datos de usuarios de prueba
const usersData = [
    {
        username: 'admin',
        email: 'admin@admin.com',
        phone: '+1234567890',
        password: 'admin123',
        roleName: 'admin'
    },
    {
        username: 'coadmin',
        email: 'coadmin@admin.com',
        phone: '+1234567891',
        password: 'coadmin123',
        roleName: 'co-admin'
    },
    {
        username: 'user1',
        email: 'user1@test.com',
        phone: '+1234567892',
        password: 'user123',
        roleName: 'user'
    },
    {
        username: 'user2',
        email: 'user2@test.com',
        phone: '+1234567893',
        password: 'user123',
        roleName: 'user'
    }
];

// Datos de propiedades de prueba
const propertiesData = [
    // Propiedades de VENTA
    {
        title: 'Casa Moderna en Dallas',
        description: 'Hermosa casa de dos pisos con acabados de lujo, ubicada en una zona residencial exclusiva de Dallas. Cuenta con amplio jardín, piscina y sistema de seguridad.',
        businessMode: 'sale',
        price: {
            sale: 450000,
            taxes: 5500,
            deedConditions: 'Acepta financiamiento bancario. Gastos de escrituración a cargo del comprador.'
        },
        address: {
            street: '123 Oak Street',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75201',
            coordinates: {
                lat: 32.7767,
                lng: -96.7970
            }
        },
        details: {
            bedrooms: 4,
            bathrooms: 3.5,
            squareFeet: 3200,
            propertyType: 'house',
            yearBuilt: 2020,
            parking: true,
            petFriendly: true,
            furnished: false
        },
        amenities: ['pool', 'gym', 'security', 'garden', 'ac'],
        status: 'DISPONIBLE'
    },
    {
        title: 'Apartamento en el Centro',
        description: 'Moderno apartamento de dos habitaciones en el corazón de Dallas. Vista espectacular de la ciudad, cerca de restaurantes y comercios.',
        businessMode: 'sale',
        price: {
            sale: 285000,
            taxes: 3200
        },
        address: {
            street: '456 Main Avenue',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75202',
            coordinates: {
                lat: 32.7831,
                lng: -96.8067
            }
        },
        details: {
            bedrooms: 2,
            bathrooms: 2,
            squareFeet: 1400,
            propertyType: 'apartment',
            yearBuilt: 2019,
            parking: true,
            petFriendly: false,
            furnished: false
        },
        amenities: ['gym', 'security', 'elevator', 'ac'],
        status: 'DISPONIBLE'
    },
    
    // Propiedades de RENTA
    {
        title: 'Casa en Renta - Uptown',
        description: 'Acogedora casa de 3 habitaciones ideal para familias. Ubicada en zona tranquila con excelentes escuelas cercanas. Jardín amplio y garaje para dos autos.',
        businessMode: 'rent',
        price: {
            monthlyRent: 2500,
            deposit: 2500,
            leaseDuration: 12,
            maintenance: 150,
            leaseConditions: 'Se requieren referencias laborales y comprobantes de ingresos. No se aceptan mascotas.'
        },
        address: {
            street: '789 Maple Drive',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75204',
            coordinates: {
                lat: 32.8081,
                lng: -96.7995
            }
        },
        details: {
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1800,
            propertyType: 'house',
            yearBuilt: 2015,
            parking: true,
            petFriendly: false,
            furnished: false
        },
        amenities: ['garden', 'laundry', 'ac', 'heating'],
        status: 'DISPONIBLE'
    },
    {
        title: 'Loft en Deep Ellum',
        description: 'Loft tipo industrial completamente amueblado en el vibrante barrio de Deep Ellum. Perfecto para profesionales o estudiantes. A pasos de arte, música y vida nocturna.',
        businessMode: 'rent',
        price: {
            monthlyRent: 1800,
            deposit: 1800,
            leaseDuration: 6,
            maintenance: 100,
            leaseConditions: 'Disponible inmediatamente. Se acepta contrato de 6 meses mínimo.'
        },
        address: {
            street: '321 Elm Street',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75226',
            coordinates: {
                lat: 32.7855,
                lng: -96.7803
            }
        },
        details: {
            bedrooms: 1,
            bathrooms: 1,
            squareFeet: 850,
            propertyType: 'apartment',
            yearBuilt: 2018,
            parking: false,
            petFriendly: true,
            furnished: true
        },
        amenities: ['internet', 'ac', 'laundry'],
        status: 'DISPONIBLE'
    },
    
    // Propiedades RENTA/VENTA (both)
    {
        title: 'Casa de Inversión - Lake Highlands',
        description: 'Excelente oportunidad de inversión. Casa en perfectas condiciones que puede ser adquirida o rentada. Ubicación privilegiada cerca de parques y centros comerciales.',
        businessMode: 'both',
        price: {
            sale: 350000,
            taxes: 4200,
            deedConditions: 'Acepta ofertas. Posibilidad de financiamiento directo con el vendedor.',
            monthlyRent: 2200,
            deposit: 3300,
            leaseDuration: 12,
            maintenance: 200,
            leaseConditions: 'Contrato renovable anualmente. Se requiere aval y referencias.'
        },
        address: {
            street: '555 Lake Drive',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75218',
            coordinates: {
                lat: 32.8670,
                lng: -96.7236
            }
        },
        details: {
            bedrooms: 3,
            bathrooms: 2.5,
            squareFeet: 2100,
            propertyType: 'house',
            yearBuilt: 2017,
            parking: true,
            petFriendly: true,
            furnished: false
        },
        amenities: ['pool', 'garden', 'security', 'ac', 'heating'],
        status: 'DISPONIBLE'
    },
    {
        title: 'Condominio Premium - Victory Park',
        description: 'Condominio de lujo con todas las comodidades. Disponible para venta o renta a largo plazo. Gimnasio, piscina, seguridad 24/7 y estacionamiento subterráneo.',
        businessMode: 'both',
        price: {
            sale: 425000,
            taxes: 5000,
            deedConditions: 'Incluye una plaza de estacionamiento. HOA incluido en el precio.',
            monthlyRent: 2800,
            deposit: 2800,
            leaseDuration: 12,
            maintenance: 300,
            leaseConditions: 'HOA incluido en la renta. Disponible para contratos corporativos.'
        },
        address: {
            street: '888 Victory Plaza',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75219',
            coordinates: {
                lat: 32.7896,
                lng: -96.8104
            }
        },
        details: {
            bedrooms: 2,
            bathrooms: 2,
            squareFeet: 1650,
            propertyType: 'condo',
            yearBuilt: 2021,
            parking: true,
            petFriendly: false,
            furnished: true
        },
        amenities: ['pool', 'gym', 'security', 'elevator', 'ac', 'internet'],
        status: 'DISPONIBLE'
    },
    {
        title: 'Townhouse en Preston Hollow',
        description: 'Elegante townhouse en zona exclusiva. Ideal para familias que buscan calidad de vida. Opción de compra o renta flexible. Acabados premium y diseño contemporáneo.',
        businessMode: 'both',
        price: {
            sale: 520000,
            taxes: 6200,
            deedConditions: 'Negociable. Acepta permuta por propiedad de menor valor.',
            monthlyRent: 3200,
            deposit: 4800,
            leaseDuration: 24,
            maintenance: 250,
            leaseConditions: 'Preferencia para contratos de 2 años. Familia con referencias impecables.'
        },
        address: {
            street: '999 Preston Road',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75230',
            coordinates: {
                lat: 32.8915,
                lng: -96.8023
            }
        },
        details: {
            bedrooms: 4,
            bathrooms: 3,
            squareFeet: 2800,
            propertyType: 'townhouse',
            yearBuilt: 2022,
            parking: true,
            petFriendly: true,
            furnished: false
        },
        amenities: ['pool', 'gym', 'security', 'garden', 'ac', 'heating', 'balcony'],
        status: 'DISPONIBLE'
    },
    
    // Propiedades con estados diferentes
    {
        title: 'Casa en Contrato',
        description: 'Propiedad actualmente en proceso de contrato.',
        businessMode: 'sale',
        price: {
            sale: 380000,
            taxes: 4500
        },
        address: {
            street: '111 Contract Ave',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75205',
            coordinates: {
                lat: 32.8142,
                lng: -96.8011
            }
        },
        details: {
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1900,
            propertyType: 'house',
            yearBuilt: 2016,
            parking: true,
            petFriendly: true,
            furnished: false
        },
        amenities: ['garden', 'ac'],
        status: 'EN_CONTRATO'
    },
    {
        title: 'Casa Vendida Recientemente',
        description: 'Propiedad ya vendida - histórico.',
        businessMode: 'sale',
        price: {
            sale: 395000,
            taxes: 4700
        },
        address: {
            street: '222 Sold Street',
            city: 'Dallas',
            state: 'Texas',
            zipCode: '75206',
            coordinates: {
                lat: 32.8234,
                lng: -96.7856
            }
        },
        details: {
            bedrooms: 3,
            bathrooms: 2.5,
            squareFeet: 2000,
            propertyType: 'house',
            yearBuilt: 2018,
            parking: true,
            petFriendly: false,
            furnished: false
        },
        amenities: ['pool', 'garden'],
        status: 'VENDIDA'
    }
];

async function seedDatabase() {
    try {
        console.log('🌱 Conectando a MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        // Limpiar base de datos
        console.log('\n🗑️  Limpiando base de datos...');
        await User.deleteMany({});
        await Property.deleteMany({});
        console.log('✅ Base de datos limpiada');

        // Obtener roles
        console.log('\n👥 Obteniendo roles...');
        const roles = await Role.find();
        
        if (roles.length === 0) {
            console.log('⚠️  No hay roles en la base de datos. Ejecuta primero: npm run setup');
            process.exit(1);
        }
        
        const roleMap = {};
        roles.forEach(role => {
            roleMap[role.role] = role._id;
        });
        console.log('✅ Roles obtenidos:', Object.keys(roleMap));

        // Crear usuarios
        console.log('\n👤 Creando usuarios de prueba...');
        const createdUsers = [];
        
        for (const userData of usersData) {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            const user = new User({
                username: userData.username,
                email: userData.email,
                phone: userData.phone,
                password: hashedPassword,
                role: roleMap[userData.roleName]
            });
            await user.save();
            createdUsers.push(user);
            console.log(`  ✓ Usuario creado: ${userData.username} (${userData.email}) - Rol: ${userData.roleName}`);
        }

        // Obtener el admin para asignar como creador
        const adminUser = createdUsers.find(u => u.username === 'admin');

        // Crear propiedades
        console.log('\n🏠 Creando propiedades de prueba...');
        
        for (const propertyData of propertiesData) {
            const property = new Property({
                ...propertyData,
                createdBy: adminUser._id,
                lastModifiedBy: adminUser._id
            });
            await property.save();
            
            const modeLabel = 
                propertyData.businessMode === 'sale' ? '💵 VENTA' :
                propertyData.businessMode === 'rent' ? '🔑 RENTA' :
                '🏢 RENTA/VENTA';
            
            console.log(`  ✓ ${modeLabel}: ${propertyData.title} - ${propertyData.status}`);
        }

        console.log('\n✅ Seed completado exitosamente!');
        console.log('\n📊 Resumen:');
        console.log(`  • ${createdUsers.length} usuarios creados`);
        console.log(`  • ${propertiesData.length} propiedades creadas`);
        console.log('\n🔐 Credenciales de acceso:');
        console.log('  Admin:');
        console.log('    Email: admin@admin.com');
        console.log('    Password: admin123');
        console.log('  Co-Admin:');
        console.log('    Email: coadmin@admin.com');
        console.log('    Password: coadmin123');
        console.log('  Usuario 1:');
        console.log('    Email: user1@test.com');
        console.log('    Password: user123');
        console.log('  Usuario 2:');
        console.log('    Email: user2@test.com');
        console.log('    Password: user123');

    } catch (error) {
        console.error('❌ Error en seed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
        process.exit(0);
    }
}

// Ejecutar seed
seedDatabase();
