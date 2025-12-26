import AuthUser from "../models/authUser.model.js";
import Call from "../models/call.model.js";
import Event from "../models/event.model.js";
import EventAttendee from "../models/eventAttended.model.js"; // attendees info
import mongoose from "mongoose";
import { getAutoTimeSlot } from "../utils/timeSloat.js";


const getAllEvent = async (req, res) => {
  try {
    const events = await Event.aggregate([
      // 1️⃣ Match active events
      { $match: { isActive: true } },

      // 2️⃣ Lookup attendees
      {
        $lookup: {
          from: "eventattendees", // Make sure this matches your MongoDB collection name
          localField: "_id",
          foreignField: "event",
          as: "attendees",
        },
      },

      // 3️⃣ Lookup calls
      {
        $lookup: {
          from: "calls",
          localField: "_id",
          foreignField: "event",
          as: "calls",
        },
      },

      // 4️⃣ Compute stats
      {
        $addFields: {
          totalRegistered: { $size: "$attendees" },

          totalDonorVisited: {
            $size: {
              $filter: {
                input: "$attendees",
                as: "a",
                cond: { $eq: ["$$a.status", "DONATED"] },
              },
            },
          },

          totalRejected: {
            $size: {
              $filter: {
                input: "$attendees",
                as: "a",
                cond: { $eq: ["$$a.status", "REJECTED"] },
              },
            },
          },

          totalRegisteredNotCome: {
            $size: {
              $filter: {
                input: "$attendees",
                as: "a",
                cond: { $eq: ["$$a.status", "PENDING"] },
              },
            },
          },

          totalCallMade: {
            $size: {
              $ifNull: ["$calls", []], // If calls array is missing, count as 0
            },
          },
        },
      },

      // 5️⃣ Format date and final output
      {
        $project: {
          name: 1,
          place: 1,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalRegistered: 1,
          totalDonorVisited: 1,
          totalRejected: 1,
          totalRegisteredNotCome: 1,
          totalCallMade: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Events fetched successfully",
      events,
    });
  } catch (error) {
    console.error("Get All Events Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};




const getEventDetailsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Event ID",
      });
    }

    const event = await Event.findById(id).lean();
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // ✅ Fetch attendees
    const attendees = await EventAttendee.find({ event: id })
      .populate({
        path: "user",
        select: "email contact profile",
        populate: {
          path: "profile",
          select: "name bloodGroup",
        },
      })
      .lean();

    // ✅ Fetch calls
    const calls = await Call.find({ event: id }).lean();

    let totalRegistered = attendees.length;
    let totalDonorVisited = 0;
    let totalRejected = 0;
    let totalRegisteredNotCome = 0;
    let totalCallMade = calls.length;

    const rejectionReasons = {};
    const bloodGroupDistribution = {};

    attendees.forEach((attendee) => {
      if (attendee.status === "DONATED") {
        totalDonorVisited++;

        // Count blood group only for donated users
        const bg = attendee.user?.profile?.bloodGroup;
        if (bg) {
          bloodGroupDistribution[bg] =
            (bloodGroupDistribution[bg] || 0) + 1;
        }
      } 
      else if (attendee.status === "REJECTED") {
        totalRejected++;
        if (attendee.rejectedReason) {
          rejectionReasons[attendee.rejectedReason] =
            (rejectionReasons[attendee.rejectedReason] || 0) + 1;
        }
      } 
      else {
        totalRegisteredNotCome++;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        name: event.name,
        date: event.date.toISOString().split("T")[0],
        place: event.place,
        totalRegistered,
        totalDonorVisited,
        totalRejected,
        totalRegisteredNotCome,
        totalCallMade, // ✅ now correct
        rejectionReasons,
        bloodGroupDistribution,
      },
    });
  } catch (error) {
    console.error("Get Event Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};






const getRegisteredUsersByEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const attendees = await EventAttendee.find({ event: id })
      .populate({
        path: "user",
        select: "email contact profile",
        populate: {
          path: "profile",
          select: "name bloodGroup",
        },
      })
      .lean();

    const results = await Promise.all(
      attendees.map(async (a) => {
        if (!a.user) return null;

        const lastCall = await Call.findOne({
          event: id,
          user: a.user._id,
        })
          .sort({ callNumber: -1 })
          .lean();

        const totalCallMade = await Call.countDocuments({
          event: id,
          user: a.user._id,
        });

        return {
          id: a.user._id,

          // ✅ NAME FROM USER PROFILE
          name: a.user.profile?.name || "",

          email: a.user.email || "",
          contact: a.user.contact || "",

          bloodGroup: a.user.profile?.bloodGroup || "",

          status: a.status,
          rejectedReason: a.rejectedReason,

          totalCallMade,
          lastCallFeedback: lastCall?.description || "",
          lastCallTime: lastCall?.callTime || null,
          timeSloat:a.checkInTime,
          callStatus:lastCall?.status,
        };
      })
    );

    res.status(200).json({
      success: true,
      total: results.filter(Boolean).length,
      data: results.filter(Boolean),
    });
  } catch (error) {
    console.error("getRegisteredUsersByEvent error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



const getUnregisteredUsersByEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }


    const registeredUsers = await EventAttendee.find(
      { event: id },
      { user: 1 }
    ).lean();

    const registeredUserIds = registeredUsers.map((r) => r.user);


    const users = await AuthUser.find({
      _id: { $nin: registeredUserIds },
      isActive: true,
    })
      .select("email contact")
      .populate({
        path: "profile",
        select: "name",
      })
      .lean();

    /* 4️⃣ Response */
    res.status(200).json({
      success: true,
      total: users.length,
      data: users.map((u) => ({
        id: u._id,
        profile: {
          name: u.profile?.name || "",

        },
        email: u.email || "",
        contact: u.contact || "",
      })),
    });
  } catch (error) {
    console.error("Get Unregistered Users Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const registerUserToEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, time } = req.body;

    /* 1️⃣ Validate IDs */
    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid event or user ID",
      });
    }

    /* 2️⃣ Event check */
    const event = await Event.findById(id);
    if (!event || !event.isActive) {
      return res.status(404).json({
        success: false,
        message: "Event not found or inactive",
      });
    }

    /* 3️⃣ User check */
    const user = await AuthUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* 4️⃣ Duplicate check */
    const exists = await EventAttendee.findOne({
      event: id,
      user: userId,
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "User already registered for this event",
      });
    }

    /* 5️⃣ FINAL TIME SLOT LOGIC (THIS IS KEY) */
    let finalTimeSlot = time;

    if (!time || typeof time !== "string" || time.trim() === "") {
      finalTimeSlot = getAutoTimeSlot();
    }

    /* 6️⃣ Save */
    const attendee = await EventAttendee.create({
      event: id,
      user: userId,
      status: "PENDING",
      checkInTime: finalTimeSlot,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: attendee,
    });
  } catch (error) {
    console.error("Register User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};






const addEvent = async (req, res) => {
  try {
    const {
      name,
      date,
      startTime,
      endTime,
      place,
      description,
      isActive,
    } = req.body;


    if (!name || !date || !startTime || !endTime || !place) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }


    // let volunteerIds = [];
    // if (Array.isArray(volunteers) && volunteers.length > 0) {
    //   volunteerIds = volunteers.filter((id) =>
    //     mongoose.Types.ObjectId.isValid(id)
    //   );
    // }


    const event = await Event.create({
      name,
      date: new Date(date),
      startTime,
      endTime,
      place,
      description: description || "",
      //   volunteers: volunteerIds,
      isActive: isActive !== undefined ? isActive : true,
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    console.error("Add Event Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (!event.isActive) {
      return res.status(400).json({
        success: false,
        message: "Event is already inactive",
      });
    }

    event.isActive = false;
    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event marked as inactive successfully",
      eventId: event._id,
    });
  } catch (error) {
    console.error("Error in deleteEvent:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



const updateEventAttendeeStatus = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { status, description, rejectionReason, timeSlot, callStatus } = req.body;

    // 🔹 Handle CALL_MADE
    if (status === "CALL_MADE") {
      if (!callStatus) {
        return res.status(400).json({
          success: false,
          message: "Call status is required",
        });
      }

      const lastCall = await Call.findOne({ event: id, user: userId }).sort({ callNumber: -1 });
      const newCallNumber = lastCall ? lastCall.callNumber + 1 : 1;

      // Only require description if callStatus is ANSWERED AND no timeSlot provided
      if (callStatus === "ANSWERED" && !timeSlot && !description) {
        return res.status(400).json({
          success: false,
          message: "Description is required if time slot is not provided for answered calls",
        });
      }

      // Create call log
      const newCall = await Call.create({
        event: id,
        user: userId,
        callNumber: newCallNumber,
        description: callStatus === "ANSWERED" ? (description || "") : "",
        status: callStatus,
        callTime: new Date(),
      });

      // Only update attendee timeSlot if provided
      const attendeeUpdate = {};
      if (timeSlot) attendeeUpdate.checkInTime = timeSlot;
      attendeeUpdate.updatedAt = new Date();

      const attendee = await EventAttendee.findOneAndUpdate(
        { event: id, user: userId },
        attendeeUpdate,
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Call logged successfully",
        call: newCall,
        attendee,
      });
    }

    // 🔹 Handle DONATED / REJECTED
    const allowedStatus = ["PENDING", "DONATED", "REJECTED"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    if ((status === "DONATED" || status === "REJECTED") && !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "Time slot is required",
      });
    }

    if (status === "REJECTED" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
      timeSlot, // always update for DONATED / REJECTED
      rejectedReason: status === "REJECTED" ? rejectionReason : "",
    };

    const attendee = await EventAttendee.findOneAndUpdate(
      { event: id, user: userId },
      updateData,
      { new: true }
    );

    if (!attendee) {
      return res.status(404).json({
        success: false,
        message: "Attendee not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        status === "REJECTED"
          ? "User rejected successfully"
          : `User marked as ${status}`,
      attendee,
    });
  } catch (error) {
    console.error("Update Attendee Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};









export { getAllEvent, getEventDetailsById, addEvent, deleteEvent, getRegisteredUsersByEvent, getUnregisteredUsersByEvent, registerUserToEvent, updateEventAttendeeStatus };
