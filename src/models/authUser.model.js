import mongoose from "mongoose";

const authUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    contact: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

authUserSchema.pre("validate", async function () {
  if (!this.email && !this.contact) {
    throw new Error("At least one of email or contact is required");
  }
});

authUserSchema.virtual("profile", {
  ref: "UserProfile",
  localField: "_id",
  foreignField: "authUser",
  justOne: true,
});

authUserSchema.set("toJSON", { virtuals: true });
authUserSchema.set("toObject", { virtuals: true });

const AuthUser = mongoose.model("AuthUser", authUserSchema);

export default AuthUser;
