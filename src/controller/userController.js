import { users } from "../seeds/userSeeds.js";
import Role from "../models/role.model.js";
import Area from '../models/area.model.js'
import AuthUser from "../models/authUser.model.js";
import { hashPassword } from "../utils/hash.js";
import connectDB from "../config/db.js";
import UserProfile from "../models/userProfile.model.js";
import mongoose from "mongoose";



const getAllUsers = async (req, res) => {
  try {
    const filters = req.query;

console.log(filters.area);

    const query = {
    };
    if (filters.area && mongoose.Types.ObjectId.isValid(filters.area)) {
      query.area = new mongoose.Types.ObjectId(filters.area);
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive === "true";
    }

    if (filters.email) {
      query.email = { $regex: filters.email, $options: "i" };
    }

    if (filters.contact) {
      query.contact = { $regex: filters.contact, $options: "i" };
    }

    // 4️⃣ Fetch volunteers
    let user = await AuthUser.find(query)
      .select("email contact isActive area")
      .populate({
        path: "profile",
        select: "name -authUser",
      })
      .populate({
        path: "area",
        select: "name pincode",
      })
      .lean({ virtuals: true });

    if (filters.name) {
      const keyword = filters.name.toLowerCase();
      user = user.filter(
        (v) => v?.profile?.name?.toLowerCase().includes(keyword)
      );
    }

    if (filters.pincode) {
      user = user.filter(
        (v) => v?.area?.pincode?.includes(filters.pincode)
      );
    }

    res.status(200).json({
      success: true,
      total: user.length,
      users: user
    });
  } catch (error) {
    console.error("Get Volunteers Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const getAllUsers1 = async (req, res) => {
  try {
    await connectDB();
    const users = await AuthUser.find({ isActive: true })
      .populate({
        path: "profile",
        select: "name bloodGroup",
      })
      .select("email contact profile")
      .lean();

    return res.status(200).json({
      success: true,
      total: users.length,
      users: users.map((u) => ({
        _id: u._id,
        name: u.profile?.name || "",
        email: u.email || "",
        contact: u.contact || "",
        bloodGroup: u.profile?.bloodGroup || null,
      })),
    });
  } catch (error) {
    console.error("Get All Users Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const seedUser = async (req, res) => {
  await connectDB()
  try {
    for (const user of users) {
      const role = await Role.findOne({ name: user.role })
      if (!role) {
        console.log(`❌ Role not found for user: ${user.name}`)
        continue
      }
      let areaId = null
      if (role.name !== "SUPER_ADMIN") {
        const area = await Area.findOne({ name: user.area })
        if (!area) {
          console.log(`❌ Area not found for user: ${user.name}`)
          continue
        }
        areaId = area._id
      }
      try {
        const authUser = await AuthUser.create({
          email: user.email,
          contact: user.contact,
          password: await hashPassword(user.password),
          role: role._id,
          area: areaId,
        })

        await UserProfile.create({
          authUser: authUser._id,
          gender: "MALE",
          name: user.name,
        })

        console.log(`✅ User created: ${user.email}`)
      } catch (err) {
        console.log(`❌ Error creating user ${user.email}: ${err.message}`)
      }
    }
    res.send("✅ User seeding process completed.")
  } catch (error) {
    console.error("❌ Error seeding users:", error)
    res.status(500).send("User seeding failed")
  }
}



export { seedUser, getAllUsers };
