import { verifyToken } from "../utils/jwt.js";
import AuthUser from "../models/authuser.model.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }
    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token);    
    if (!decoded) {
      return res.status(401).json({
        message: "Invalid or expired token",
        success: false,
      });
    }
    const user = await AuthUser.findById(decoded.userId).select("tokenVersion");    
    if (!user) {
      return res.status(401).json({
        message: "User not found",
        success: false,
      });
    }
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        message: "Token revoked",
        success: false,
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({
      message: "Authentication failed",
      success: false,
    });
  }
};
