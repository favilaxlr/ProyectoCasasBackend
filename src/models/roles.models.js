import mongoose from 'mongoose';


const roleSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        trim: true
    }
}); //Fin de roleSchema

export default mongoose.model('Role', roleSchema);