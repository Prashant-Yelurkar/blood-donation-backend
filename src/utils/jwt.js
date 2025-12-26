import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"; 


export const generateToken = async (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};


export const verifyToken = async(token) => {
  try {
    return await jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};
