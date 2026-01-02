import AuthUser from "../models/authUser.model.js";
import UserProfile from "../models/userProfile.model.js";
import { comparePassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";
import connectDB from "../config/db.js";
const login = async (req, res) => {
    try {
        await connectDB();
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res
                .status(400)
                .json({ message: "Email and password are required" });
        }
        const user = await AuthUser.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { contact: identifier.replace(/\s+/g, "") },
            ],
        })
            .select("+password tokenVersion area role")
            .populate("role", "name")
            .populate("area", "name pincode")

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password" });
        }
        const profile = await UserProfile.findOne({ authUser: user._id });
        const token = await generateToken({
            userId: user._id,
            role: user.role.name,
            tokenVersion: user.tokenVersion,
        });
        res.status(200).json({
            jwt: token,
            user: {
                name: profile?.name,
                role: user.role.name,
                id: user._id,
                area: user.area ? {
                    name:user.area.name,
                    id:user.area._id,
                    pincode:user.area.pincode
                }: null,
            },
            message: "Login successful",
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export { login };
