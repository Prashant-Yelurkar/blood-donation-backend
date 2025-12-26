import bcrypt from 'bcrypt';
const saltRounds = 10; 

const hashPassword = async (plainPassword) => {
    try{
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
        return hashedPassword;
    } catch (error) {
        throw new Error('Error hashing password: ' + error.message);
    }   

};

const comparePassword = async (plainPassword, hashedPassword) => {
    try {
        const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
        return isMatch;
    } catch (error) {
        throw new Error('Error comparing password: ' + error.message);
    }
};

export { hashPassword, comparePassword };

