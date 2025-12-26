import mongoose from "mongoose";

const rejectionReasonSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      required: true,
      enum: [
        "LOW_HEMOGLOBIN",
        "UNDERAGE",
        "OVERWEIGHT",
        "FEVER_ILLNESS",
        "OTHER"
      ],
      unique: true,
      trim: true,
    },

    category: {
      type: String,
      enum: ["HEALTH", "AGE", "WEIGHT", "OTHER"],
      default: "OTHER",
    },

    description: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthUser",
    },
  },
  { timestamps: true }
);

const RejectionReason = mongoose.model("RejectionReason", rejectionReasonSchema);
export default RejectionReason;
