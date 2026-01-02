import mongoose from "mongoose";

const areaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // city: {
    //   type: String,
    //   required: true,
    //   trim: true,
    // },

    // district: {
    //   type: String,
    //   trim: true,
    // },

    // state: {
    //   type: String,
    //   trim: true,
    // },

    pincode: {
      type: String,
      trim: true,
    },

    // Optional geo-location (future use: maps, distance)
    // location: {
    //   type: {
    //     type: String,
    //     enum: ["Point"],
    //     default: "Point",
    //   },
    //   coordinates: {
    //     type: [Number], // [longitude, latitude]
    //   },
    // },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthUser",
    },
  },
  {
    timestamps: true,
  }
);

// Enable geo queries if needed later
areaSchema.index({ location: "2dsphere" });

const Area = mongoose.model("Area", areaSchema);
export default Area;
