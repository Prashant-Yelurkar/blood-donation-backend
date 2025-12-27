import { users1 } from "../seeds/userSeeds.js";
import Role from "../models/role.model.js";
import AuthUser from "../models/authUser.model.js";
import { hashPassword } from "../utils/hash.js";
import connectDB from "../config/db.js";
import UserProfile from "../models/userProfile.model.js";



const getAllUsers = async (req, res) => {
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

// const seedUser = async (req, res) => {
//   try {
//     for (const user of users) {
//       const exists = await Role.findOne({ name: user.role });
//       if (exists) {
//         try {
//           await AuthUser.create({
//             email: user.email,
//             contact: user.contact,
//             password: await hashPassword(user.password),
//             role: exists._id,
//           });
//           console.log(`✅ User created: ${user.email}`);
//         } catch (err) {
//           console.log(`❌ Error creating user ${user.email}: ${err.message}`);
//         }
//       } else {
//         console.log(`❌ Role not found for user: ${user.email}`);
//       }
//     }
//   } catch (error) {
//     console.error("❌ Error seeding roles:", error);
//   } finally {
//     res.send("Role seeding process completed.");
//   }
// };

const seedUser = async (req, res) => {
  await connectDB();

  try {
    for (const user of users1) {
      const exists = await Role.findOne({ name: user.role });

      if (!exists) {
        console.log(`❌ Role not found for user: ${user.email}`);
        continue;
      }

      try {
        const authUser = await AuthUser.create({
          email: user.email,
          contact: user.contact,
          password: await hashPassword("admin@123"),
          role: exists._id,
        });

        await UserProfile.create({
          authUser: authUser._id, // ✅ FIXED
          gender: "MALE",
          name: user.name,
        });

        console.log(`✅ User created: ${user.email}`);
      } catch (err) {
        console.log(`❌ Error creating user ${user.email}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Error seeding users:", error);
  } finally {
    res.send("User seeding process completed.");
  }
};


export { seedUser, getAllUsers };
