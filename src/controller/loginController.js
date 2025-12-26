import AuthUser from "../models/authuser.model.js";
import UserProfile from "../models/userProfile.model.js";
import { comparePassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res
                .status(400)
                .json({ message: "Email and password are required" });
        }
        const user = await AuthUser.findOne({
            $or: [{ email: identifier }, { contact: identifier }],
        })
            .select("+password")
            .populate("role");

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
                userId: user._id,
            },
            message: "Login successful",
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal Server Error" });
    }

    return res.json({ message: "Login successful" });
};

export { login };
