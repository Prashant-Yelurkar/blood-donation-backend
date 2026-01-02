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

    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    place: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    volunteers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AuthUser",
          required: true,
        },

        permissions: {
          canCall: {
            type: Boolean,
            default: false,
          },
          canAcceptAttendance: {
            type: Boolean,
            default: false,
          },
        },

        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
    isCompleted:{
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Event", EventSchema);
