import AuthUser from "../models/authUser.model.js";
import Role from "../models/role.model.js";
import { hashPassword } from "../utils/hash.js";
import mongoose from "mongoose";
import UserProfile from "../models/userProfile.model.js";
import { parseCSV, parseExcel } from "../utils/parseFile.js";
import connectDB from "../config/db.js";
import Area from "../models/area.model.js";

// const getAllVolunteers = async (req, res) => {

//   try {
//     const role = await Role.findOne({ name: "VOLUNTEER" });
//     if (!role) {
//       return res.status(404).json({
//         message: "Volunteer role not found",
//         success: false,
//       });
//     }

//     const volunteers = await AuthUser.find({
//       role: role._id,
//     })
//       .select("email contact isActive")
//       .populate({
//         path: "profile",
//         select: "name dob age",
//       }).populate({
//         path:"area",
//         select:"name pincode",
//       });

//     if (!volunteers.length) {
//       return res.status(404).json({
//         message: "No volunteers found",
//         success: false,
//       });
//     }

//     res.status(200).json({
//       message: "Get all volunteers",
//       success: true,
//       volunteers,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Server error",
//       success: false,
//     });
//   }
// };




const getAllVolunteers = async (req, res) => {
  try {
    const filters = req.query;

    // 1️⃣ Get volunteer role
    const role = await Role.findOne({ name: "VOLUNTEER" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Volunteer role not found",
      });
    }

    // 2️⃣ Base Mongo query
    const query = {
      role: role._id,
    };

    // 3️⃣ DB-level filters
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
    let volunteers = await AuthUser.find(query)
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

    // 5️⃣ JS-level filters (virtual / populated)
    if (filters.name) {
      const keyword = filters.name.toLowerCase();
      volunteers = volunteers.filter(
        (v) => v?.profile?.name?.toLowerCase().includes(keyword)
      );
    }

    if (filters.pincode) {
      volunteers = volunteers.filter(
        (v) => v?.area?.pincode?.includes(filters.pincode)
      );
    }

    res.status(200).json({
      success: true,
      total: volunteers.length,
      volunteers,
    });
  } catch (error) {
    console.error("Get Volunteers Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
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
      .select("email contact isActive")
      .populate({
        path: "profile",
        select: "name dob age gender bloodGroup weight lastDonationDate address workAddress",
      })
      .populate({
        path: "area",
        select: "id, name, pincode"
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
      area,
      isActive,
    } = req.body;

    if ((!email && !contact) || !name || !gender || !area) {
      return res.status(400).json({ success: false, message: "Required fields are missing" });
    }

    const role = await Role.findOne({ name: "VOLUNTEER" });
    if (!role) return res.status(404).json({ success: false, message: "Volunteer role not found" });

    const existingUser = await AuthUser.findOne({
      $or: [
        ...(email?.trim() ? [{ email: email.trim() }] : []),
        ...(contact?.trim() ? [{ contact: contact.trim() }] : []),
      ],
    });

    if (existingUser)
      return res.status(409).json({ success: false, message: "Email or contact already exists" });

    const place = await Area.findById(area);
    if (!place)
      return res.status(409).json({ success: false, message: "Area not found" });

    const authUserData = {
      password: await hashPassword(name.split(" ")[0].toLowerCase() + "@123"),
      role: role._id,
      isActive: isActive,
      area: place._id,
    };

    if (email?.trim()) authUserData.email = email.trim();
    if (contact?.trim()) authUserData.contact = contact.trim();
    const newVolunteer = await AuthUser.create(authUserData);

    const userProfileData = { authUser: newVolunteer._id };
    if (name) userProfileData.name = name;
    if (dob) userProfileData.dob = dob;
    if (gender) userProfileData.gender = gender.toUpperCase();
    if (bloodGroup) userProfileData.bloodGroup = bloodGroup;
    if (weight) userProfileData.weight = weight;
    if (address) userProfileData.address = address;
    if (workAddress) userProfileData.workAddress = workAddress;
    if (lastDonationDate) userProfileData.lastDonationDate = lastDonationDate;

    try {
      await UserProfile.create(userProfileData);
    } catch (err) {

      await AuthUser.deleteOne({ _id: newVolunteer._id });
      throw err;
    }

    res.status(201).json({
      success: true,
      message: "Volunteer added successfully",
      volunteerId: newVolunteer._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};




const updateVolunteer = async (req, res) => {
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
      area,
      isActive,
    } = req.body;
    console.log(req.body);


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
    });

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


    if (isActive !== undefined) {
      isActive === true || isActive === "true";
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

    console.log(profileUpdate);

    if (Object.keys(profileUpdate).length) {
      await UserProfile.updateOne(
        { authUser: id },
        { $set: profileUpdate }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Volunteer updated successfully",
    });
  } catch (error) {
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





const seedVolunteers = async (req, res) => {
  await connectDB();
  console.log("Connected DB:", mongoose.connection.name);

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // 1️⃣ Parse file
    let records = [];
    if (req.file.mimetype === "text/csv") {
      records = await parseCSV(req.file.buffer);
    } else {
      records = parseExcel(req.file.buffer);
    }

    if (!records.length) {
      return res.status(400).json({
        success: false,
        message: "File is empty",
      });
    }

    // 2️⃣ Get volunteer role
    const volunteerRole = await Role.findOne({ name: "VOLUNTEER" });
    if (!volunteerRole) {
      return res.status(400).json({
        success: false,
        message: "VOLUNTEER role not found",
      });
    }

    const inserted = [];
    const skipped = [];
    const errors = [];


    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      // Required validation
      if (!row.name || !row.gender || (!row.email && !row.contact) || !row.area)  {
        errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }



      const email = row.email?.trim().toLowerCase();
      const contact = row.contact
        ? String(row.contact).trim()
        : null;

      const conditions = [];
      if (email) conditions.push({ email });
      if (contact) conditions.push({ contact });

      const exists = conditions.length
        ? await AuthUser.findOne({ $or: conditions })
        : null;
      if (exists) {
        skipped.push(i + 1);
        continue;
      }

      // 4️⃣ Create AuthUser
      const hashedPassword = await hashPassword(String(row.contact));
      const authUserPayload = {
        password: hashedPassword,
        role: volunteerRole._id,
      };

      if (email) authUserPayload.email = email;
      if (contact) authUserPayload.contact = contact;
      const area = await Area.findOne({name:row.area});
      
      if (!area)
      {
        skipped.push(i + 1);
        continue;
      }
      if(area) authUserPayload.area = area._id;
     

      const authUser = await AuthUser.create(authUserPayload);

      console.log("AuthUser saved:", authUser._id);


      // 5️⃣ Create UserProfile
      const userProfilePayload = {
        authUser: authUser._id,
        name: row.name.trim(),
        gender: row.gender.toUpperCase(),
        signupSource: "DIRECT",
      };

      if (row.dob) userProfilePayload.dob = parseExcelDate(row.dob);
      if (row.bloodGroup) userProfilePayload.bloodGroup = row.bloodGroup;
      if (row.weight) userProfilePayload.weight = Number(row.weight);
      if (row.lastDonationDate)
        userProfilePayload.lastDonationDate = parseExcelDate(row.lastDonationDate);
      if (row.address) userProfilePayload.address = row.address;
      if (row.workAddress) userProfilePayload.workAddess = row.workAddress;

      await UserProfile.create(userProfilePayload);

      inserted.push(i + 1);
    }

    // ⚠️ If validation errors exist
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Validation errors in file",
        errors,
        inserted: inserted.length,
        skipped: skipped.length,
      });
    }

    // ✅ Success
    res.status(200).json({
      success: true,
      message: "Volunteer seed completed",
      totalRows: records.length,
      inserted: inserted.length,
      skipped: skipped.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

const parseExcelDate = (value) => {
  if (!value) return null;

  // Case 1: Excel serial number
  if (typeof value === "number") {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  // Case 2: DD/MM/YYYY string
  if (typeof value === "string" && value.includes("/")) {
    const [dd, mm, yyyy] = value.split("/");
    return new Date(`${yyyy}-${mm}-${dd}`);
  }

  // Case 3: Already valid date
  const d = new Date(value);
  return isNaN(d) ? null : d;
};




export { getAllVolunteers, getVolunteerById, addVolunteer, updateVolunteer, deleteVolunteer, seedVolunteers };