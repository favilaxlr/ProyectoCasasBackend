import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

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

async function makeAdmin() {
    try {
        await mongoose.connect('mongodb://127.0.0.1/frfamilyinvestments');
        
        const adminRole = await Role.findOne({ role: 'admin' });
        const user = await User.findOne({ username: 'testuser' });
        
        if (user && adminRole) {
            user.role = adminRole._id;
            await user.save();
            console.log('Usuario testuser convertido a admin');
        } else {
            console.log('Usuario testuser no encontrado');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

makeAdmin();