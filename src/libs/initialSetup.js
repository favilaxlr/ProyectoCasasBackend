import Role from '../models/roles.models.js';
import User from '../models/user.models.js';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import  { connectDB } from '../db.js';

export const initializeSetup = async () =>{
    try {
        //Configuremos la lectura de variables de entorno
        dotenv.config();

        //Nos conectamos a la base de datos
        connectDB();

        const roleAdmin = process.env.SETUP_ROLE_ADMIN;
        const roleUser = process.env.SETUP_ROLE_USER;

        //Buscamos si existe algun rol creado en la base de datos
        const countRoles = await Role.estimatedDocumentCount();

        //Si countRole es 0, 
        if (countRoles == 0){
            //Hay que crear los roles de usuario en la base de datos
            console.log("Creando roles de usuario");
            await Promise.all([
                new Role( { role: roleUser } ).save(),
                new Role( { role: roleAdmin } ).save(),
                new Role( { role: 'co-admin' } ).save(),
            ])
        }; //Fin de if(CountRoles)

        //IMPORTAMOS los datos del usuario ADMINISTRADOR defninidos en .env
        const setupAdminName = process.env.SETUP_ADMIN_USERNAME;
        const setupPwd = process.env.SETUP_ADMIN_PWD;
        const setupEmail = process.env.SETUP_ADMIN_EMAIL;
        const setupPhone = process.env.SETUP_ADMIN_PHONE || '+1234567890'; // Teléfono por defecto si no está en .env

        //Buscamos si existe un usuario admin
        const userAdmin = await User.findOne({username: setupAdminName});
        if ( userAdmin == null){ //No existe un usuario administrador
            //Se crea un usuario tomando las variables de ambiente
            console.log("Creando un usuario admin");
            const roleAdminDB= await Role.findOne({role: roleAdmin});
            const passwordAdmin = await bcryptjs.hash(setupPwd, 10);
            const newUserAdmin = new User({
                username: setupAdminName,
                email: setupEmail,
                phone: setupPhone,
                password: passwordAdmin,
                role: roleAdminDB._id
            });
            await newUserAdmin.save();
            console.log("Roles y usuarios inicializados")
        };//Fin d if(userAdmin ==null)
    } catch (error){
        console.log(error);
        console.log("Error al inciar los roles de usuario");

    }
};//Fin de initializeSetup

initializeSetup();