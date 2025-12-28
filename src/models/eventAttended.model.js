import mongoose from "mongoose";
const EventAttendeeSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthUser", // Donor
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "DONATED", "REJECTED","CANCLED"],
      default: "PENDING",
    },

    rejectedReason: {
      type: String,
      default: null,
    },

    checkInTime: {
      type: String,
      default: Date.now,
    },
  },
  { timestamps: true }
)
EventAttendeeSchema.index(
  { event: 1, user: 1 },
  { unique: true }
);

export default mongoose.model("EventAttendee", EventAttendeeSchema);
