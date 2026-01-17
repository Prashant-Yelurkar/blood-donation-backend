import AuthUser from "../models/authUser.model.js";
import Role from "../models/role.model.js";
import { hashPassword } from "../utils/hash.js";
import mongoose from "mongoose";
import UserProfile from "../models/userProfile.model.js";
import { parseCSV, parseExcel } from "../utils/parseFile.js";
import Area from "../models/area.model.js";




const getAllDonor = async (req, res) => {
  try {
    const filters = req.query;


    // 1️⃣ Get volunteer role
    const role = await Role.findOne({ name: "USER" });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "User role not found",
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
    console.log(filters);

    // 4️⃣ Fetch volunteers
    let donor = await AuthUser.find(query)
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
      donor = user.filter(
        (v) => v?.profile?.name?.toLowerCase().includes(keyword)
      );
    }

    if (filters.pincode) {
      donor = donor.filter(
        (v) => v?.area?.pincode?.includes(filters.pincode)
      );
    }

    res.status(200).json({
      success: true,
      total: donor.length,
      donors: donor,
    });
  } catch (error) {
    console.error("Get Volunteers Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
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

    const donorDoc = await AuthUser.findOne({
      role: role._id,
      _id: new mongoose.Types.ObjectId(req.params.id),
    })
      .select("email contact area isActive")
      .populate({
        path: "profile",
        select:
          "name dob age gender bloodGroup weight lastDonationDate address workAddress referral",
      })
      .populate({
        path: "area",
        select: "name pincode",
      });

    if (!donorDoc) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    const donor = donorDoc.toObject();
    if (
      donor?.profile?.referral?.type === "USER" &&
      donor?.profile?.referral?.referredUser
    ) {
      const refProfile = await AuthUser.findById(
        donor.profile.referral.referredUser
      )
        .populate({
          path: "profile",
          select:
            "name",
        })
        .lean();

      donor.profile.referral = {
        ...donor.profile.referral,
        name: refProfile?.profile?.name || null,
      };
    }


    return res.status(200).json({
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
      workAddress,       // 👈 new field
      lastDonationDate,
      referredBy,        // 👈 optional
      area,
    } = req.body;


    // ----------------- BASIC VALIDATION -----------------
    if (!(email || contact) || !(name && gender)) {
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


    const validArea = await Area.findById(area);
    if (!validArea) {
      return res.status(404).json({
        success: false,
        message: "Donor Area not found",
      });
    }
    const authUserData = {
      password: await hashPassword(
        "blood@123",
      ),
      role: role._id,
      isActive: true,
      area: validArea._id
    };

    if (email?.trim()) authUserData.email = email.trim();
    if (contact?.trim()) authUserData.contact = contact.trim();

    const newUser = await AuthUser.create(authUserData);

    let referralData = { type: "DIRECT", referredUser: null };
    let signupSource = "DIRECT";

    if (referredBy && mongoose.Types.ObjectId.isValid(referredBy)) {
      const referredProfile = await AuthUser.findById(referredBy);

      if (referredProfile) {
        referralData = { type: "USER", referredUser: referredProfile._id };
        signupSource = "REFERRAL";
      }
    }


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
      if (referredBy) userProfileData.referral = referralData;

      await UserProfile.create(userProfileData);
    } catch (err) {
      await AuthUser.deleteOne({ _id: newUser._id });
      throw err;
    }

    res.status(201).json({
      success: true,
      message: "Donor added successfully",
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






const updateDonor = async (req, res) => {
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
      referral,
      area,
      isActive,
    } = req.body;

    // Check role
    const role = await Role.findOne({ name: "USER" });
    if (!role) {
      return res.status(404).json({ success: false, message: "User role not found" });
    }

    const donor = await AuthUser.findOne({ _id: id, role: role._id });
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    // Check for duplicate email/contact
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

    // Update AuthUser dynamically
    const authUpdate = {};
    if (email) authUpdate.email = email.trim();
    if (contact) authUpdate.contact = contact.trim();

    if (area) {
      authUpdate.area = area._id;
    }
    if (isActive !== undefined) {
      isActive === true || isActive === "true";
      authUpdate.isActive = isActive;
    }

    if (Object.keys(authUpdate).length) {
      await AuthUser.updateOne({ _id: id }, { $set: authUpdate });
    }

    // Update UserProfile dynamically
    const profileUpdate = {};
    if (name) profileUpdate.name = name;
    if (dob) profileUpdate.dob = dob;
    if (gender) profileUpdate.gender = gender.toUpperCase();
    if (bloodGroup) profileUpdate.bloodGroup = bloodGroup;
    if (weight !== undefined && weight !== "") profileUpdate.weight = weight;
    if (address) profileUpdate.address = address;
    if (workAddress) profileUpdate.workAddress = workAddress;
    if (lastDonationDate) profileUpdate.lastDonationDate = lastDonationDate;
    if (referral) profileUpdate.referral = referral;




    if (Object.keys(profileUpdate).length) {
      await UserProfile.updateOne({ authUser: id }, { $set: profileUpdate });
    }



    res.status(200).json({
      success: true,
      message: "Donor updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



const deleteDonor = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(id);

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


const seedDonor = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // 1️⃣ Parse file
    let records = [];
    if (req.file.mimetype === "text/csv") {
      records = await parseCSV(req.file.buffer);
    } else {
      records = parseExcel(req.file.buffer);
    }

    if (!records.length) {
      return res.status(400).json({ success: false, message: "File is empty" });
    }

    const donorRole = await Role.findOne({ name: "USER" });
    if (!donorRole) {
      return res.status(400).json({ success: false, message: "DONOR role not found" });
    }

    const inserted = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      // 🔴 Required validation
      if (!row.name || !row.gender || !row.area || (!row.email && !row.contact)) {
        errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      const email = row.email?.trim().toLowerCase();
      const contact = row.contact ? String(row.contact).trim() : null;

      // 🔁 Duplicate check
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

      // 2️⃣ Create AuthUser
      const hashedPassword = await hashPassword("blood@123");
      const authUserPayload = {
        password: hashedPassword,
        role: donorRole._id,
      };

      if (email) authUserPayload.email = email;
      if (contact) authUserPayload.contact = contact;
      const area = await Area.findOne({ name: row.area });

      if (!area) {
        skipped.push(i + 1);
        continue;
      }
      if (area) authUserPayload.area = area._id;

      const authUser = await AuthUser.create(authUserPayload);

      console.log("AuthUser saved:", authUser._id);

      // 3️⃣ Handle Referral
      let referral = {
        type: "DIRECT",
        referredUser: null,
      };

      if (row.refrence_contact) {
        const refContact = row.refrence_contact
          ? String(row.refrence_contact).trim()
          : null;


        const refAuth = await AuthUser.findOne({
          $or: [
            refContact ? { contact: refContact } : {},
          ],
        });

        if (refAuth) {
          const refProfile = await UserProfile.findOne({ authUser: refAuth._id });

          if (refProfile) {
            referral = {
              type: "USER",
              referredUser: refAuth._id,
            };
          }
        } else if (row.refrence) {
          referral.type = row.refrence.toUpperCase();
        }
      } else if (row.refrence) {
        referral.type = row.refrence.toUpperCase();
      }

      // 4️⃣ Create UserProfile
      const profilePayload = {
        authUser: authUser._id,
        name: row.name.trim(),
        gender: row.gender.toUpperCase(),
        signupSource: "DIRECT",
        referral,
      };

      if (row.dob) profilePayload.dob = parseExcelDate(row.dob);
      if (row.bloodGroup) profilePayload.bloodGroup = row.bloodGroup;
      if (row.weight) profilePayload.weight = Number(row.weight);
      if (row.lastDonationDate)
        profilePayload.lastDonationDate = parseExcelDate(row.lastDonationDate);
      if (row.address) profilePayload.address = row.address;
      if (row.workAddress) profilePayload.workAddess = row.workAddress;

      await UserProfile.create(profilePayload);

      inserted.push(i + 1);
    }

    // ⚠️ Validation errors
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors,
        inserted: inserted.length,
        skipped: skipped.length,
      });
    }

    // ✅ Success
    res.status(200).json({
      success: true,
      message: "Donor seed completed",
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


export { getAllDonor, getDonorById, addDonor, updateDonor, deleteDonor, seedDonor };