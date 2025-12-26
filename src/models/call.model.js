import mongoose from "mongoose";
const CallSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthUser",
      required: true,
    },

    // volunteer: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "AuthUser",
    //   required: true,
    // },

    callNumber: {
      type: Number, // 1 to 5
      required: true,
      default:1
    },

    status: {
      type: String,
      enum: ["ANSWERED", "NOT_CONNECTED", "NOT_ANSWERED",],
      required: true,
    },

    description: {
      type: String,    
    },

    callTime: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/* Prevent duplicate call number */
CallSchema.index(
  { event: 1, user: 1, callNumber: 1 },
  { unique: true }
);

export default mongoose.model("Call", CallSchema);
