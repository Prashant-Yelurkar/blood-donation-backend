import AuthUser from "../models/authUser.model.js";
import Role from "../models/role.model.js";
import { hashPassword } from "../utils/hash.js";
import mongoose from "mongoose";
import UserProfile from "../models/userProfile.model.js";
import Area from "../models/area.model.js";


const gatAllAdmin = async (req, res) => {
  try {
    const role = await Role.findOne({ name: "ADMIN" });
    if (!role) {
      return res.status(404).json({
        message: "Admin role not found",
        success: false,
      });
    }

    const admin = await AuthUser.find({
      role: role._id,
    })
      .select("email contact isActive area")
      .populate({
        path:"area",
        select:"name pincode"
      })
      .populate({
        path: "profile",
        select: "name dob age",
      });

    if (!admin.length) {
      return res.status(404).json({
        message: "No admin found",
        success: false,
      });
    }

    res.status(200).json({
      message: "Get all admin",
      success: true,
      admin,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};


const getAdminById = async (req, res) => {
  try {
    const role = await Role.findOne({ name: "ADMIN" });
    if (!role) {
      return res.status(404).json({
        message: "Admin role not found",
        success: false,
      });
    }

    const admin = await AuthUser.findOne({
      role: role._id,
      _id: new mongoose.Types.ObjectId(req.params.id),
    })
      .select("email contact isActive")
      .populate({
        path: "profile",
        select: "name dob age gender bloodGroup weight lastDonationDate address workAddress",
      })
      .populate({
        path:"area",
        select:"name pincode"
      });      

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
        success: false,
      });
    }

    res.status(200).json({
      message: "Admin fetched successfully",
      success: true,
      admin,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};


const addAdmin = async (req, res) => {
  try {
    const {
      email,
      contact,
      name,
      dob,
      gender,
      bloodGroup,
      weight,
      address,
      workAddress,       
      lastDonationDate,
      area    
    } = req.body;

    if (!(email || contact) || !(name && gender && area) ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    const role = await Role.findOne({ name: "ADMIN" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "ADMIN role not found",
      });
    }
    const validArea = await Area.findById(area);
    if (!validArea) {
      return res.status(404).json({
        success: false,
        message: "ADMIN Area not found",
      });
    }    
    const existingUser = await AuthUser.findOne({
      $or: [
        ...(email?.trim() ? [{ email }] : []),
        ...(contact?.trim() ? [{ contact }] : []),
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or contact already exists",
      });
    }

  
    const authUserData = {
      password: await hashPassword(
        "blood@123",
      ),
      area:validArea._id,
      role: role._id,
      isActive: true,
    };

    if (email?.trim()) authUserData.email = email.trim();
    if (contact?.trim()) authUserData.contact = contact.trim();

    const newUser = await AuthUser.create(authUserData);


    try {
      const userProfileData = { authUser: newUser._id };

      if (name) userProfileData.name = name;
      if (dob) userProfileData.dob = dob;
      if (gender) userProfileData.gender = gender.toUpperCase();
      if (bloodGroup) userProfileData.bloodGroup = bloodGroup;
      if (weight) userProfileData.weight = weight;
      if (address) userProfileData.address = address;
      if (workAddress) userProfileData.workAddress = workAddress;
      if (lastDonationDate) userProfileData.lastDonationDate = lastDonationDate;
    if(area) userProfileData.area = validArea._id;
      await UserProfile.create(userProfileData);
    } catch (err) {
      await AuthUser.deleteOne({ _id: newUser._id });
      throw err;
    }

    res.status(201).json({
      success: true,
      message: "Admin added successfully",
      donorId: newUser._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};






const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      email,
      contact,
      name,
      dob,
      gender,
      bloodGroup,
      weight,
      address,
      workAddress,
      lastDonationDate,
      isActive,
      area,
    } = req.body;

    const role = await Role.findOne({ name: "ADMIN" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Admin role not found",
      });
    }

    const admin = await AuthUser.findOne({ _id: id, role: role._id });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // 🔁 Duplicate email / contact check
    if (email || contact) {
      const duplicate = await AuthUser.findOne({
        _id: { $ne: id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(contact ? [{ contact }] : []),
        ],
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Email or contact already in use",
        });
      }
    }


    const authUpdate = {};

    if (email) authUpdate.email = email.trim();
    if (contact) authUpdate.contact = contact.trim();

    if (isActive !== undefined) {
    isActive  === true || isActive === "true";
    authUpdate.isActive = isActive;
    }

   
    if (area) {
      authUpdate.area = area;
    }

    if (Object.keys(authUpdate).length) {
      await AuthUser.updateOne({ _id: id }, { $set: authUpdate });
    }

    const profileUpdate = {};

    if (name) profileUpdate.name = name;
    if (dob) profileUpdate.dob = dob;
    if (gender) profileUpdate.gender = gender.toUpperCase();
    if (bloodGroup) profileUpdate.bloodGroup = bloodGroup;
    if (weight !== undefined && weight !== "") profileUpdate.weight = weight;
    if (address) profileUpdate.address = address;
    if (workAddress) profileUpdate.workAddress = workAddress;
    if (lastDonationDate) profileUpdate.lastDonationDate = lastDonationDate;

    if (Object.keys(profileUpdate).length) {
      await UserProfile.updateOne(
        { authUser: id },
        { $set: profileUpdate }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Admin updated successfully",
    });
  } catch (error) {
    console.error("Update admin error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};





const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ name: "ADMIN" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Admin role not found",
      });
    }


    const admin = await AuthUser.findOne({
      _id: id,
      role: role._id,
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }


    await UserProfile.deleteOne({ authUser: id });


    await AuthUser.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      message: "Admin deleted permanently",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};









export { gatAllAdmin, getAdminById, addAdmin, updateAdmin, deleteAdmin };