import Role from "../models/role.model.js";
import { roles } from "../seeds/roleSeeds.js";

export const seedRoles = async (req, res) => {
  try {
    for (const role of roles) {
      const exists = await Role.findOne({ name: role.name });
      if (!exists) {
        await Role.create(role);
        console.log(`✅ Role created: ${role.name}`);
      } else {
        console.log(`ℹ️ Role already exists: ${role.name}`);
      }
    }
  } catch (error) {
    console.error("❌ Error seeding roles:", error);
  }
  finally{
    res.send("Role seeding process completed.");
  }
};


export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ message: "Error fetching roles", error });
  }
};