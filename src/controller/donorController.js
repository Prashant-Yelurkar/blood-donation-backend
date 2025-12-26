import AuthUser from "../models/authUser.model.js";
import Role from "../models/role.model.js";
import { hashPassword } from "../utils/hash.js";
import mongoose from "mongoose";
import UserProfile from "../models/userProfile.model.js";


const getAllDonor = async (req, res) => {
  try {
    const role = await Role.findOne({ name: "USER" });
    if (!role) {
      return res.status(404).json({
        message: "Volunteer role not found",
        success: false,
      });
    }

    const donors = await AuthUser.find({
      role: role._id,
      isActive: true,
    })
      .select("email contact")
      .populate({
        path: "profile",
        select: "name dob age",
      });

    if (!donors.length) {
      return res.status(404).json({
        message: "No donors found",
        success: false,
      });
    }

    res.status(200).json({
      message: "Get all donor",
      success: true,
      donors,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};


const getDonorById = async (req, res) => {
  try {
    const role = await Role.findOne({ name: "USER" });
    if (!role) {
      return res.status(404).json({
        message: "Donor role not found",
        success: false,
      });
    }

    const donor = await AuthUser.findOne({
      role: role._id,
      _id: new mongoose.Types.ObjectId(req.params.id),
    })
      .select("email contact")
      .populate({
        path: "profile",
        select: "name dob age gender bloodGroup weight lastDonationDate address",
      });

    if (!donor) {
      return res.status(404).json({
        message: "Donor not found",
        success: false,
      });
    }

    res.status(200).json({
      message: "Donor fetched successfully",
      success: true,
      donor,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};


const addDonor = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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
      lastDonationDate,
      referredBy, // 👈 optional
    } = req.body;

    // ----------------- BASIC VALIDATION -----------------
    const hasContact = email || contact;
    const hasRequiredFields = name  && gender && bloodGroup;

    if (!hasContact || !hasRequiredFields) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    // ----------------- ROLE -----------------
    const role = await Role.findOne({ name: "USER" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Donor role not found",
      });
    }

    // ----------------- DUPLICATE CHECK -----------------
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

    // ----------------- CREATE AUTH USER -----------------
    const authUserData = {
      password: await hashPassword(
        name.split(" ")[0].toLowerCase() + "@123"
      ),
      role: role._id,
      isActive: true,
    };

    // add only if present
    if (email?.trim()) {
      authUserData.email = email.trim();
    }

    if (contact?.trim()) {
      authUserData.contact = contact.trim();
    }

    const [newUser] = await AuthUser.create(
      [authUserData],
      { session }
    );
    // ----------------- REFERRAL LOGIC -----------------
    let referralData = {
      type: "DIRECT",
      referredUser: null,
    };

    let signupSource = "DIRECT";

    if (referredBy && mongoose.Types.ObjectId.isValid(referredBy)) {
      const referredProfile = await UserProfile.findOne({
        authUser: referredBy,
      }).session(session);

      if (referredProfile) {
        referralData = {
          type: "USER",
          referredUser: referredProfile._id,
        };

        signupSource = "REFERRAL";
      }
    }

    // ----------------- CREATE PROFILE -----------------
    await UserProfile.create(
      [
        {
          authUser: newUser._id,
          name,
          dob,
          gender: gender.toUpperCase(),
          bloodGroup,
          weight,
          address,
          lastDonationDate,

          referral: referralData,
          signupSource,
        },
      ],
      { session }
    );

    // ----------------- COMMIT -----------------
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Donor added successfully",
      donorId: newUser._id,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};




const updateDonor = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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
      lastDonationDate,
    } = req.body;

    const role = await Role.findOne({ name: "USER" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "User role not found",
      });
    }

    const donor = await AuthUser.findOne({
      _id: id,
      role: role._id,
    }).session(session);

    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }


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
    if (email) authUpdate.email = email;
    if (contact) authUpdate.contact = contact;

    if (Object.keys(authUpdate).length) {
      await AuthUser.updateOne(
        { _id: id },
        { $set: authUpdate },
        { session }
      );
    }

    const profileUpdate = {};
    if (name) profileUpdate.name = name;
    if (dob) profileUpdate.dob = dob;
    if (gender) profileUpdate.gender = gender.toUpperCase();
    if (bloodGroup) profileUpdate.bloodGroup = bloodGroup;
    if (weight !== undefined && weight !== '') profileUpdate.weight = weight;
    if (address) profileUpdate.address = address;
    if (lastDonationDate)
      profileUpdate.lastDonationDate = lastDonationDate;
    console.log(profileUpdate);

    if (Object.keys(profileUpdate).length) {
      await UserProfile.updateOne(
        { authUser: id },
        { $set: profileUpdate },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Volunteer updated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const deleteDonor = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ name: "USER" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Volunteer role not found",
      });
    }

    const donor = await AuthUser.findOneAndUpdate(
      {
        _id: id,
        role: role._id,
        isActive: true,
      },
      {
        $set: { isActive: false },
      },
      { new: true }
    );

    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "Donor not found or already deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Donor deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


export { getAllDonor, getDonorById, addDonor, updateDonor, deleteDonor };