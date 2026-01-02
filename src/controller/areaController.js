import mongoose from 'mongoose'
import Area from '../models/area.model.js'
import { AreaData } from '../seeds/areaSeeds.js'
import AuthUser from '../models/authUser.model.js'
import Event from '../models/event.model.js'

const addArea = async (req, res) => {
  try {
    const { name, pincode , isActive } = req.body
    if (!name || !pincode) {
      return res.status(400).json({
        message: 'Area name and pincode are required',
      })
    }
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        message: 'Pincode must be 6 digits',
      })
    }


    const existingArea = await Area.findOne({
      name: name.trim(),
      pincode,
      isActive
    })
    console.log(existingArea);


    if (existingArea) {
      return res.status(409).json({
        message: 'Area already exists',
      })
    }
    const area = await Area.create({
      name: name.trim(),
      pincode,
      isActive
    })

    return res.status(201).json({
      message: 'Area added successfully',
      area,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      message: 'Internal server error',
    })
  }
}




const getAreas = async (req, res) => {
  try {
    const areas = await Area.aggregate([
      {
        $sort: { createdAt: -1 },
      },

      // 🔹 Admin count
      {
        $lookup: {
          from: "authusers",
          let: { areaId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$area", "$$areaId"] },
                    { $eq: ["$isActive", true] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $match: { "role.name": "ADMIN" } },
          ],
          as: "admins",
        },
      },

      // 🔹 Volunteer count
      {
        $lookup: {
          from: "authusers",
          let: { areaId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$area", "$$areaId"] },
                    { $eq: ["$isActive", true] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $match: { "role.name": "VOLUNTEER" } },
          ],
          as: "volunteers",
        },
      },

      // 🔹 Donor count
      {
        $lookup: {
          from: "authusers",
          let: { areaId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$area", "$$areaId"] },
                    { $eq: ["$isActive", true] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $match: { "role.name": "DONOR" } },
          ],
          as: "donors",
        },
      },

      // 🔹 Event count
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "area",
          as: "events",
        },
      },

      // 🔹 Final shape
      {
        $project: {
          name: 1,
          pincode: 1,
           isActive: 1,  
          adminCount: { $size: "$admins" },
          volunteerCount: { $size: "$volunteers" },
          donorCount: { $size: "$donors" },
          eventCount: { $size: "$events" },

        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Areas fetched successfully",
      areas,
    });
  } catch (error) {
    console.error("Get areas error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAreaDetails = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid area id",
    });
  }

  try {
    const area = await Area.findById(id).select("name pincode isActive");
    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Area details fetched successfully",
      area,
    });
  } catch (error) {
    console.error("Get area details error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



const updateArea = async (req, res) => {
  const { id } = req.params;  
  const { name, pincode, isActive } = req.body
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid area id",
    });
  }
  
  try {

    const area = await Area.findById(id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }
    
    if (name) {
      const exists = await Area.findOne({
        _id: { $ne: id },
        name: name.trim(),
      });
      
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Area name already exists",
        });
      }
    }
    
    const update = {};
    
    if (name) update.name = name.trim();
    if (pincode) update.pincode = pincode.trim();
    if (isActive) update.isActive = isActive;
    
    if (!Object.keys(update).length) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided to update",
      });
    }
    
    await Area.updateOne(
      { _id: id },
      { $set: update }
    );
    
    return res.status(200).json({
      success: true,
      message: "Area updated successfully",
    });
    
  } catch (error) {
    console.error("Update area error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    const area = await Area.findById(id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    // if (!area.isActive) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Area already deleted",
    //   });
    // }

 
    const linkedUsers = await AuthUser.exists({
      area: id,
      isActive: true,
    });

    if (linkedUsers) {
      return res.status(409).json({
        success: false,
        message: "Area cannot be deleted. Users are assigned to this area.",
      });
    }


    const linkedEvents = await Event.findOne({ area: id });
    if (linkedEvents) {
      return res.status(409).json({
        success: false,
        message: "Area cannot be deleted. Events exist for this area.",
      });
    }


    await area.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Area deleted successfully",
    });
  } catch (error) {
    console.error("Delete area error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



const seedAreas = async (req, res) => {
  console.log("here");
  
  try {
    const added = [];
    const alreadyPresent = [];

    for (const area of AreaData) {
      const exists = await Area.findOne({
        name: area.name.trim(),
      });

      if (exists) {
        console.log(`⚠️ Area already exists: ${area.name}`);
        alreadyPresent.push(area.name);
      } else {
        await Area.create({
          ...area,
          name: area.name.trim(),
        });
        console.log(`✅ Area added: ${area.name}`);
        added.push(area.name);
      }
    }

    res.json({
      success: true,
      message: "Area seeding completed",
      added,
      alreadyPresent,
    });
  } catch (error) {
    console.error("❌ Seeding failed", error);
    res.status(500).json({
      success: false,
      message: "Area seeding failed",
    });
  }
};
export { addArea, getAreas, seedAreas , getAreaDetails, updateArea , deleteArea}
