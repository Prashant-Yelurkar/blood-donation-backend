import AuthUser from "../models/authUser.model.js";
import Role from "../models/role.model.js";
import { hashPassword } from "../utils/hash.js";
import mongoose from "mongoose";
import UserProfile from "../models/userProfile.model.js";

const getAllVolunteers = async (req, res) => {
    try {
        const role = await Role.findOne({ name: "VOLUNTEER" });
        if (!role) {
            return res.status(404).json({
                message: "Volunteer role not found",
                success: false,
            });
        }

        const volunteers = await AuthUser.find({
            role: role._id,
            isActive: true,
        })
            .select("email contact")
            .populate({
                path: "profile",
                select: "name dob age",
            });

        if (!volunteers.length) {
            return res.status(404).json({
                message: "No volunteers found",
                success: false,
            });
        }

        res.status(200).json({
            message: "Get all volunteers",
            success: true,
            volunteers,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Server error",
            success: false,
        });
    }
};


const getVolunteerById = async (req, res) => {
  try {
    const role = await Role.findOne({ name: "VOLUNTEER" });
    if (!role) {
      return res.status(404).json({
        message: "Volunteer role not found",
        success: false,
      });
    }

    const volunteer = await AuthUser.findOne({
      role: role._id,
      _id: new mongoose.Types.ObjectId(req.params.id),
    })
      .select("email contact")
      .populate({
        path: "profile",
        select: "name dob age gender bloodGroup weight lastDonationDate address",
      });

    if (!volunteer) {
      return res.status(404).json({
        message: "Volunteer not found",
        success: false,
      });
    }

    res.status(200).json({
      message: "Volunteer fetched successfully",
      success: true,
      volunteer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};



const addVolunteer = async (req, res) => {
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
            lastDonationDate
        } = req.body;



        const hasContact = email || contact;
        const hasRequiredFields = name && dob && gender && bloodGroup;

        if (!hasContact || !hasRequiredFields) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing",
            });
        }


        const role = await Role.findOne({ name: "VOLUNTEER" });
        if (!role) {
            return res.status(404).json({
                message: "Volunteer role not found",
                success: false,
            });
        }

        const existingUser = await AuthUser.findOne({
            $or: [
                ...(email?.trim() ? [{ email }] : []),
                ...(contact?.trim() ? [{ contact }] : []),
            ],
        });

        console.log(existingUser);


        if (existingUser) {
            return res.status(409).json({
                message: "Email or contact already exists",
                success: false,
            });
        }


        const cleanEmail = email?.trim() || null;
        const cleanContact = contact?.trim() || null;

        const newVolunteer = await AuthUser.create(
            [{
                email: cleanEmail,
                contact: cleanContact,
                password: await hashPassword(name.split(" ")[0].toLowerCase() + "@" + "123"),
                role: role._id,
                isActive: true,
            }],
            { session }
        );




        await UserProfile.create(
            [
                {
                    authUser: newVolunteer[0]._id,
                    name,
                    dob,
                    gender: gender.toUpperCase(),
                    bloodGroup,
                    weight,
                    address,
                    lastDonationDate
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: "Volunteer added successfully",
            success: true,
            volunteerId: newVolunteer[0]._id,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error(error);
        res.status(500).json({
            message: "Server error",
            success: false,
        });
    }
};

const updateVolunteer = async (req, res) => {
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

    const role = await Role.findOne({ name: "VOLUNTEER" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Volunteer role not found",
      });
    }

    const volunteer = await AuthUser.findOne({
      _id: id,
      role: role._id,
      isActive: true,
    }).session(session);

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found",
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
    if (weight !== undefined && weight !=='') profileUpdate.weight = weight;
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

const deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    // Ensure volunteer role
    const role = await Role.findOne({ name: "VOLUNTEER" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Volunteer role not found",
      });
    }

    // Soft delete
    const volunteer = await AuthUser.findOneAndUpdate(
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

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: "Volunteer not found or already deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Volunteer deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}; 


export { getAllVolunteers, getVolunteerById, addVolunteer , updateVolunteer, deleteVolunteer};