  import mongoose from "mongoose";


const userProfileSchema = new mongoose.Schema(
  {
    authUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthUser",
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    dob: {
      type: Date,
      // required: true,
    },

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      required: true,
    },

    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      // required:true,
    },

    weight: {
      type: Number,
      min: 18,
    },

    lastDonationDate: {
      type: Date,
    },

    address: {
      type: String,
    },

    referral: {
      type: {
        type: String,
        enum: ["USER", "DOOR_TO_DOOR", "DESK", "DIRECT"],
        default: "DIRECT",
      },

      referredUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserProfile",
        default: null,
      },
    },

    signupSource: {
      type: String,
      enum: ["REFERRAL", "DIRECT", "BENCH" , "DOOR_TO_DOOR"],
      default: "DIRECT",
    },
  },
  { timestamps: true }
);

const UserProfile = mongoose.model("UserProfile", userProfileSchema);
export default UserProfile;
