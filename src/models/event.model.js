import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String, // "10:00"
      required: true,
    },

    endTime: {
      type: String, // "16:00"
      required: true,
    },

    place: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    // volunteers: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "AuthUser",
    //   },
    // ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Event", EventSchema);
