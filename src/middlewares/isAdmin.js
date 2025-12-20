import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import dotenv from'dotenv';

//Configuramos las variables de entorno
dotenv.config()

//Obtenemos el rol del usuario para el registro de usuarios
const roleAdmin = process.env.SETUP_ROLE_ADMIN;

export const isAdmin = async (req, res, next)=>{
    try{
        const userFound = await User.findById(req.user.id)

        if(!userFound) //No se encontro el id en la base de datos
            return res.status(400)
                        .json({message: ["No autorizado, el rol para el usuario no está definido"]})

        //Obtenemos el rol para el usuario que inicio sesióm
        //Comprobamos que sea administrador
        const role = await Role.findById(userFound.role);
        if (!role) //No se encuentra el rol del usuario
            return res.status(401) //Retornamos error en el login
                        .json({message: ["No autorizado, el rol para el usuario no esta definido"]})

        if (role.role !=roleAdmin){
            return res.status(401) //Retornamos error en el login
                        .json({message: ["El usario no esta autorizado para esta operación"]})
        }

        next();
    } catch (error) {
        return res.status(401)
                    .json({message: ["No autorizado"]})
    }
    
}//Fin de isAdmin