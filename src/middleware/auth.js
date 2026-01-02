import { verifyToken } from "../utils/jwt.js";
import AuthUser from "../models/authUser.model.js";
import connectDB from "../config/db.js";

export const protect = async (req, res, next) => {
  try {
    await connectDB()
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      })
    }

    const token = authHeader.split(" ")[1]
    const decoded = await verifyToken(token)

    if (!decoded) {
      return res.status(401).json({
        message: "Invalid or expired token",
        success: false,
      })
    }

    // ✅ Fetch area + role safely
    const user = await AuthUser.findById(decoded.userId)
      .select("tokenVersion area role")
      .populate("area", "name")
      .populate("role", "name")

    if (!user) {
      return res.status(401).json({
        message: "User not found",
        success: false,
      })
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        message: "Token revoked",
        success: false,
      })
    }

    // ✅ Attach user safely
    req.user = {
      id: user._id,
      role: user.role?.name,
      area: user.area ? {name:user.area.name , id:user.area._id} : null, // SUPER_ADMIN
    }
    next()
  } catch (error) {
    console.error(error)
    res.status(401).json({
      message: "Authentication failed",
      success: false,
    })
  }
}

