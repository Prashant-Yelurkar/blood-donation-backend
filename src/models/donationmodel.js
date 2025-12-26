import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      required: true,
    },

    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    attended: {
      type: Boolean,
      default: false,
    },

    rejectedReason: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RejectionReason",
      default: null,
    },

    referralBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      default: null,
    },

    callStatus: {
      type: String,
      enum: ["NOT_CALLED", "CALLED", "CONFIRMED", "REJECTED"],
      default: "NOT_CALLED",
    },

    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

donationSchema.index({ user: 1, event: 1 }, { unique: true });

const Donation = mongoose.model("Donation", donationSchema);
export default Donation;
