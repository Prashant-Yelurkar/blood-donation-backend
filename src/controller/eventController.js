import AuthUser from "../models/authUser.model.js";
import Call from "../models/call.model.js";
import Event from "../models/event.model.js";
import EventAttendee from "../models/eventAttended.model.js"; // attendees info
import mongoose from "mongoose";
import { getAutoTimeSlot } from "../utils/timeSloat.js";
import { parseCSV, parseExcel } from "../utils/parseFile.js";
import connectDB from "../config/db.js";
import ExcelJS from 'exceljs';

import { getIO } from "../config/socket.js";
import { onlineUsers } from "../config/socketStore.js";

const getAllEvent = async (req, res) => {
  try {
    const filters = { isActive: true }; // default condition

    const {
      area,
      isCompleted,
      name,
      date,
      place,
    } = req.query;

    // 🔹 Dynamic filters
    if (area && mongoose.Types.ObjectId.isValid(area)) {
      filters.area = new mongoose.Types.ObjectId(area);
    }

    if (isCompleted !== undefined) {
      filters.isCompleted = isCompleted === "true";
    }

    if (name) {
      filters.name = { $regex: name, $options: "i" };
    }

    if (place) {
      filters.place = { $regex: place, $options: "i" };
    }

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      filters.date = { $gte: start, $lte: end };
    }

    const events = await Event.aggregate([
      // 1️⃣ Match dynamic filters
      { $match: filters },

      // 2️⃣ Lookup attendees
      {
        $lookup: {
          from: "eventattendees",
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

      // 4️⃣ Lookup area
      {
        $lookup: {
          from: "areas",
          localField: "area",
          foreignField: "_id",
          as: "area",
        },
      },

      // 5️⃣ Unwind area
      {
        $unwind: {
          path: "$area",
          preserveNullAndEmptyArrays: true,
        },
      },

      // 6️⃣ Compute stats
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

          totalCallMade: { $size: "$calls" },
        },
      },

      // 7️⃣ Final projection
      {
        $project: {
          name: 1,
          place: 1,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          area: {
            _id: "$area._id",
            name: "$area.name",
            pincode: "$area.pincode",
          },
          isCompleted: 1,
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
      total: events.length,
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

    const event = await Event.findById(id).populate({ path: "area", select: "name pincode" }).lean();
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
      event: {
        id: event._id,
        name: event.name,
        startTime: event.startTime,
        endTime: event.startTime,
        volunteers: event.volunteers,
        area: event.area,
        date: event.date.toISOString().split("T")[0],
        place: event.place,
        totalRegistered,
        totalDonorVisited,
        totalRejected,
        totalRegisteredNotCome,
        totalCallMade, // ✅ now correct
        rejectionReasons,
        bloodGroupDistribution,
        completed: event.isCompleted,
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
  await connectDB();
  try {
    const { id } = req.params;

    // const attendees = await EventAttendee.find({ event: id })
    //   .populate({
    //     path: "user",
    //     model: "AuthUser",
    //     select: "email contact role",
    //     populate: [
    //       {
    //         path: "role",          // ✅ populate role
    //         model: "Role",
    //         select: "name",   // role name + code
    //       },
    //       {
    //         path: "profile",
    //         model: "UserProfile",
    //         populate: [
    //           {
    //             path: "referral.referredUser",
    //             model: "UserProfile",
    //             populate: {
    //               path: "authUser",
    //               model: "AuthUser",
    //               select: "contact email role",
    //               populate: {
    //                 path: "role",
    //                 model: "Role",
    //                 select: "name code",
    //               },
    //             },
    //           },
    //         ],
    //       },
    //     ],
    //   })
    //   .lean();

    const attendees = await EventAttendee.find({ event: id })
      .populate({
        path: "user",
        model: "AuthUser",
        select: "email contact role profile",
        populate: [
          {
            path: "role",
            model: "Role",
            select: "name code",
          },
          {
            path: "profile",
            model: "UserProfile",
            populate: {
              path: "referral.referredUser",   // ✅ referral points to AuthUser
              model: "AuthUser",
              select: "email contact role profile",
              populate: [
                {
                  path: "role",
                  model: "Role",
                  select: "name code",
                },
                {
                  path: "profile",
                  model: "UserProfile",
                  select: "name bloodGroup",
                },
              ],
            },
          },
        ],
      })
      .lean();

    // console.log(attendees[0].user.profile.referral.referredUser.profile.name);


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
          role: a.user.role,
          email: a.user.email || "",
          contact: a.user.contact || "",
          bloodGroup: a.user.profile?.bloodGroup || "",
          status: a.status,
          rejectedReason: a.rejectedReason,
          referredBy: a.user.profile?.referral?.referredUser ? a.user?.profile.referral.referredUser?.profile?.name : a.user.profile?.referral?.type,
          totalCallMade,
          lastCallFeedback: lastCall?.description || "",
          lastCallTime: lastCall?.callTime || null,
          timeSloat: a.checkInTime,
          callStatus: lastCall?.status,
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

    // 1️⃣ Get event area
    const event = await Event.findById(id).select("area").lean();

    if (!event || !event.area) {
      return res.status(404).json({
        success: false,
        message: "Event or event area not found",
      });
    }

    // 2️⃣ Get already registered users
    const registeredUsers = await EventAttendee.find(
      { event: id },
      { user: 1 }
    ).lean();

    const registeredUserIds = registeredUsers.map((r) => r.user);

    // 3️⃣ Query users from SAME AREA as event
    const userQuery = {
      _id: { $nin: registeredUserIds },
      area: event.area,          // ✅ EVENT AREA HERE           // optional but recommended
    };

    // 4️⃣ Fetch users
    const users = await AuthUser.find(userQuery)
      .select("email contact area")
      .populate({
        path: "profile",
        select: "name",
      })
      .populate({
        path: "area",
        select: "name pincode",
      })
      .lean();

    // 5️⃣ Response
    res.status(200).json({
      success: true,
      total: users.length,
      data: users.map((u) => ({
        _id: u._id,
        profile: {
          name: u.profile?.name || "",
        },
        area: u.area || null,
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

    console.log(req.body);

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
      area,
      volunteers, // [{ userId, roles: ["CALL","ATTENDANCE"] }]
    } = req.body;

    if (!name || !date || !startTime || !endTime || !place || !area) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    // Transform frontend volunteers into EventSchema format
    let volunteerData = [];
    if (Array.isArray(volunteers) && volunteers.length > 0) {
      volunteerData = volunteers
        .filter((v) => v.userId && mongoose.Types.ObjectId.isValid(v.userId))
        .map((v) => ({
          user: v.userId,
          permissions: {
            canCall: v.roles.includes("CALL"),
            canAcceptAttendance: v.roles.includes("ATTENDANCE"),
          },
        }));
    }

    const event = await Event.create({
      name,
      date: new Date(date),
      startTime,
      endTime,
      place,
      area,
      description: description || "",
      isActive: isActive !== undefined ? isActive : true,
      volunteers: volunteerData,
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



// const updateEventAttendeeStatus = async (req, res) => {
//   try {
//     const { id, userId } = req.params;
//     const { status, description, rejectionReason, timeSlot, callStatus } = req.body;

//     // 🔹 Handle CALL_MADE
//     if (status === "CALL_MADE") {
//       if (!callStatus) {
//         return res.status(400).json({
//           success: false,
//           message: "Call status is required",
//         });
//       }

//       const lastCall = await Call.findOne({ event: id, user: userId }).sort({ callNumber: -1 });
//       const newCallNumber = lastCall ? lastCall.callNumber + 1 : 1;

//       // Only require description if callStatus is ANSWERED AND no timeSlot provided
//       if (callStatus === "ANSWERED" && !timeSlot && !description) {
//         return res.status(400).json({
//           success: false,
//           message: "Description is required if time slot is not provided for answered calls",
//         });
//       }

//       // Create call log
//       const newCall = await Call.create({
//         event: id,
//         user: userId,
//         callNumber: newCallNumber,
//         description: callStatus === "ANSWERED" ? (description || "") : "",
//         status: callStatus,
//         callTime: new Date(),
//       });

//       // Only update attendee timeSlot if provided
//       const attendeeUpdate = {};
//       if (timeSlot) attendeeUpdate.checkInTime = timeSlot;
//       attendeeUpdate.updatedAt = new Date();

//       const attendee = await EventAttendee.findOneAndUpdate(
//         { event: id, user: userId },
//         attendeeUpdate,
//         { new: true }
//       );


//       const io = getIO();
//       const senderSocketId = onlineUsers.get(req.user.id.toString()); 


//       console.log(senderSocketId);


//       // Broadcast to everyone except the sender
//       io.sockets.sockets.forEach((socket) => {
//         if (socket.id !== senderSocketId) {
//           socket.emit("event-updated", {
//             message: "Event updated successfully",
//             user:
//           });
//         }
//       });



//       return res.status(200).json({
//         success: true,
//         message: "Call logged successfully",
//         call: newCall,
//         attendee,
//       });
//     }

//     // 🔹 Handle DONATED / REJECTED
//     const allowedStatus = ["PENDING", "DONATED", "REJECTED", "CANCELLED"];
//     if (!allowedStatus.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status",
//       });
//     }

//     if ((status === "DONATED" || status === "REJECTED") && !timeSlot) {
//       return res.status(400).json({
//         success: false,
//         message: "Time slot is required",
//       });
//     }

//     if (status === "REJECTED" && !rejectionReason) {
//       return res.status(400).json({
//         success: false,
//         message: "Rejection reason is required",
//       });
//     }

//     const updateData = {
//       status,
//       updatedAt: new Date(),
//       timeSlot, // always update for DONATED / REJECTED
//       rejectedReason: status === "REJECTED" ? rejectionReason : "",
//     };

//     const attendee = await EventAttendee.findOneAndUpdate(
//       { event: id, user: userId },
//       updateData,
//       { new: true }
//     );

//     if (!attendee) {
//       return res.status(404).json({
//         success: false,
//         message: "Attendee not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message:
//         status === "REJECTED"
//           ? "User rejected successfully"
//           : `User marked as ${status}`,
//       attendee,
//     });
//   } catch (error) {
//     console.error("Update Attendee Status Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };







const updateEventAttendeeStatus = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { status, description, rejectionReason, timeSlot, callStatus } = req.body;

    let attendeeUpdateData = {};
    let callLog = null;

    // 🔹 Handle CALL_MADE
    if (status === "CALL_MADE") {
      const lastCall = await Call.findOne({ event: id, user: userId }).sort({ callNumber: -1 });
      const newCallNumber = lastCall ? lastCall.callNumber + 1 : 1;

      callLog = await Call.create({
        event: id,
        user: userId,
        callNumber: newCallNumber,
        description: callStatus === "ANSWERED" ? (description || "") : "",
        status: callStatus,
        callTime: new Date(),
      });

      if (timeSlot) attendeeUpdateData.checkInTime = timeSlot;
      attendeeUpdateData.updatedAt = new Date();
    } else {
      attendeeUpdateData = {
        status,
        updatedAt: new Date(),
        timeSlot,
        rejectedReason: status === "REJECTED" ? rejectionReason : null,
      };
    }

    // Update attendee
    const attendeeDoc = await EventAttendee.findOneAndUpdate(
      { event: id, user: userId },
      attendeeUpdateData,
      { new: true }
    )
      .populate({
        path: "user",
        model: "AuthUser",
        select: "email contact role",
        populate: [
          { path: "role", model: "Role", select: "name code" },
          {
            path: "profile", model: "UserProfile", populate: [
              {
                path: "referral.referredUser", model: "UserProfile", populate: {
                  path: "authUser",
                  model: "AuthUser",
                  select: "contact email role",
                  populate: { path: "role", model: "Role", select: "name code" },
                }
              }
            ]
          }
        ]
      })
      .lean();
    console.log(attendeeDoc.user.profile);


    if (!attendeeDoc) return res.status(404).json({ success: false, message: "Attendee not found" });

    // 🔹 Format data exactly like getRegisteredUsersByEvent
    const lastCall = await Call.findOne({ event: id, user: attendeeDoc.user._id })
      .sort({ callNumber: -1 })
      .lean();
    const totalCallMade = await Call.countDocuments({ event: id, user: attendeeDoc.user._id });

    const formattedAttendee = {
      id: attendeeDoc.user._id,
      name: attendeeDoc.user.profile?.name || "",
      role: attendeeDoc.user.role,
      email: attendeeDoc.user.email || "",
      contact: attendeeDoc.user.contact || "",
      bloodGroup: attendeeDoc.user.profile?.bloodGroup || "",
      status: attendeeDoc.status,
      rejectedReason: attendeeDoc.rejectedReason,
      referredBy: attendeeDoc.user.profile?.referral?.referredUser
        ? attendeeDoc.user.profile.referral.referredUser?.name
        : attendeeDoc.user.profile.referral?.type,
      totalCallMade,
      lastCallFeedback: lastCall?.description || "",
      lastCallTime: lastCall?.callTime || null,
      timeSloat: attendeeDoc.checkInTime,
      callStatus: lastCall?.status,
    };

    // 🔹 Broadcast to all except sender
    const io = getIO();
    // const senderSocketId = onlineUsers.get(req.user.id.toString());

    io.sockets.sockets.forEach((socket) => {
      // if (socket.id !== senderSocketId) {
      socket.emit("event-updated", {
        message: "Attendee updated successfully",
        attendee: formattedAttendee,
      });
      // }
    });

    // Respond to the API call
    return res.status(200).json({
      success: true,
      message: status === "REJECTED"
        ? "User rejected successfully"
        : status === "CALL_MADE"
          ? "Call logged successfully"
          : `User marked as ${status}`,
      attendee: formattedAttendee,
      call: callLog,
    });

  } catch (error) {
    console.error("Update Attendee Status Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};





const registerUsersToEventFromFile = async (req, res) => {
  try {
    const { id } = req.params;

    /* 1️⃣ Validate Event ID */
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    /* 2️⃣ Check Event */
    const event = await Event.findById(id);
    if (!event || !event.isActive) {
      return res.status(404).json({
        success: false,
        message: "Event not found or inactive",
      });
    }

    /* 3️⃣ Validate File */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    /* 4️⃣ Parse File */
    let records = [];
    if (req.file.mimetype === "text/csv") {
      records = await parseCSV(req.file.buffer);
    } else {
      records = parseExcel(req.file.buffer);
    }

    if (!records.length) {
      return res.status(400).json({
        success: false,
        message: "File is empty",
      });
    }

    /* 5️⃣ Result Trackers */
    const inserted = [];
    const skipped = [];
    const errors = [];

    /* 6️⃣ LOOP EACH ROW */
    for (let i = 0; i < records.length; i++) {
      const row = records[i];

      try {
        const email = row.email?.trim().toLowerCase();
        const contact = row.contact ? String(row.contact).trim() : null;
        let time = row.timeSloat;
        if (!email && !contact) {
          errors.push(`Row ${i + 1}: Email or Contact required`);
          continue;
        }

        const conditions = [];
        if (email) conditions.push({ email });
        if (contact) conditions.push({ contact });

        const user = await AuthUser.findOne({ $or: conditions });

        if (!user) {
          errors.push(`Row ${i + 1}: User not found`);
          continue;
        }

        const exists = await EventAttendee.findOne({
          event: id,
          user: user._id,
        });

        if (exists) {
          skipped.push(i + 1);
          continue;
        }

        let finalTimeSlot = time;
        if (!time || typeof time !== "string" || time.trim() === "") {
          finalTimeSlot = getAutoTimeSlot();
        }

        /* REGISTER */
        await EventAttendee.create({
          event: id,
          user: user._id,
          status: "PENDING",
          checkInTime: finalTimeSlot,
        });

        inserted.push(i + 1);
      } catch (err) {
        console.error(`Row ${i + 1} error`, err);
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk registration completed",
      totalRows: records.length,
      inserted: inserted.length,
      skipped: skipped.length,
      errors,
    });
  } catch (error) {
    console.error("Bulk Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};





// const getEventReport = async (req, res) => {
//   try {
//     const { eventId } = req.params;
//     await connectDB();
//     if (!mongoose.Types.ObjectId.isValid(eventId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid event ID",
//       });
//     }

//     /* 🔹 Fetch attendees with user & profile */

//     const attendees = await EventAttendee.find({ event: eventId })
//       .select("status user rejectedReason checkInTime")
//       .populate({
//         path: "user",
//         select: "email contact area",
//         populate: [
//           // 🔹 populate user's profile
//           {
//             path: "profile",
//             model: "UserProfile",
//             select:
//               "name referral bloodGroup address workAddress weight gender dob lastDonationDate",
//             populate: {
//               // referral.referredUser = AuthUser ID
//               path: "referral.referredUser",
//               model: "AuthUser",
//               select: "email contact",
//               populate: {
//                 // 🔑 get name from UserProfile
//                 path: "profile",
//                 model: "UserProfile",
//                 select: "name",
//               },
//             },
//           },

//           // 🔹 populate area
//           {
//             path: "area",
//             model: "Area",
//             select: "name pincode",
//           },
//         ],
//       });



//     if (!attendees.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No donor data found",
//       });
//     }
//     //   console.log(attendees[367]);

//     //   console.log(attendees[367].user.profile.referral.type);

//     // console.log(attendees[367].user.profile.referral.referredUser.contact);

//     // console.log(attendees[367].user.profile.referral.referredUser.profile.name);



//     /* 🔹 Create Excel */
//     const workbook = new ExcelJS.Workbook();
//     const sheet = workbook.addWorksheet("Donor Report");

//     sheet.columns = [
//       { header: "Donor Name", key: "name", width: 22 },
//       { header: "Contact", key: "contact", width: 16 },
//       { header: "Blood Group", key: "bloodGroup", width: 14 },
//       { header: "Address", key: "address", width: 30 },
//       { header: "Work Address", key: "workAddress", width: 30 },
//       { header: "Donation Status", key: "status", width: 16 },
//       { header: "Rejection Reason", key: "rejectionReason", width: 24 },
//       { header: "Referred By", key: "referredBy", width: 22 },
//       { header: "Referrer Contact", key: "referrerContact", width: 18 },
//     ];

//     /* 🔹 Fill Rows */
//     attendees.forEach((row) => {
//       const profile = row.user.profile || {};
//       const ref = profile.referral || {};

//       sheet.addRow({
//         name: profile?.name || "-",
//         contact: row.user?.contact || row.user?.email || "-",
//         bloodGroup: profile?.bloodGroup || "-",
//         address: profile?.address || "-",
//         workAddress: profile?.workAddess || "-",
//         status: row.status || "PENDING",
//         rejectionReason:
//           row.status === "REJECTED" ? row.rejectedReason || "-" : "-",

//         // 👇 KEY FIX HERE
//         referredBy: ref?.referredUser
//           ? ref.referredUser.profile.name
//           : ref?.type || "-",

//         referrerContact: ref?.referredUser?.contact || "-",
//       });

//     });

//     /* 🔹 Styling */
//     sheet.getRow(1).font = { bold: true };

//     /* 🔹 Response Headers */
//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=donor-report-${Date.now()}.xlsx`
//     );

//     await workbook.xlsx.write(res);
//     res.end();
//   } catch (error) {
//     console.error("Excel Export Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to export donor report",
//     });
//   }
// };




const getEventReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    /* 🔹 Fetch attendees with user, profile, referral & area */
    const attendees = await EventAttendee.find({ event: eventId })
      .select("status user rejectedReason checkInTime")
      .populate({
        path: "user",
        select: "email contact area",
        populate: [
          {
            path: "profile",
            model: "UserProfile",
            select:
              "name referral bloodGroup address workAddress weight gender dob lastDonationDate",
            populate: {
              // referral.referredUser = AuthUser
              path: "referral.referredUser",
              model: "AuthUser",
              select: "email contact",
              populate: {
                // get referred user's name
                path: "profile",
                model: "UserProfile",
                select: "name",
              },
            },
          },
          {
            path: "area",
            model: "Area",
            select: "name pincode",
          },
        ],
      })
      .lean();

    if (!attendees.length) {
      return res.status(404).json({
        success: false,
        message: "No donor data found",
      });
    }

    /* 🔹 STATUS ORDER */
    const statusOrder = {
      DONATED: 1,
      REJECTED: 2,
      CANCELLED: 3,
      PENDING: 4,
    };

    /* 🔹 SORT: status → referral name */
    attendees.sort((a, b) => {
      const statusA = statusOrder[a.status] || 99;
      const statusB = statusOrder[b.status] || 99;

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      const refA =
        a?.user?.profile?.referral?.referredUser?.profile?.name ||
        a?.user?.profile?.referral?.type ||
        "";

      const refB =
        b?.user?.profile?.referral?.referredUser?.profile?.name ||
        b?.user?.profile?.referral?.type ||
        "";

      return refA.localeCompare(refB);
    });

    /* 🔹 Create Excel */
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Donor Report");

    sheet.columns = [
      { header: "Donor Name", key: "name", width: 22 },
      { header: "Contact", key: "contact", width: 16 },
      { header: "Blood Group", key: "bloodGroup", width: 14 },
      { header: "DOB", key: "dob", width: 14 },
      { header: "Weight (kg)", key: "weight", width: 12 },
      { header: "Address", key: "address", width: 30 },
      { header: "Work Address", key: "workAddress", width: 30 },
      { header: "Area Name", key: "areaName", width: 20 },
      { header: "Pincode", key: "pincode", width: 10 },
      { header: "Last Donation Date", key: "lastDonationDate", width: 18 },
      { header: "Donation Status", key: "status", width: 16 },
      { header: "Rejection Reason", key: "rejectionReason", width: 24 },
      { header: "Referred By", key: "referredBy", width: 22 },
      { header: "Referrer Contact", key: "referrerContact", width: 18 },
    ];

    /* 🔹 Fill Rows */
    attendees.forEach((row) => {
      const profile = row.user.profile || {};
      const ref = profile.referral || {};
      const area = row.user.area || {};

      sheet.addRow({
        name: profile?.name || "-",
        contact: row.user?.contact || row.user?.email || "-",
        bloodGroup: profile?.bloodGroup || "-",
        dob: profile?.dob ? profile.dob.toISOString().split("T")[0] : "-",
        weight: profile?.weight || "-",
        address: profile?.address || "-",
        workAddress: profile?.workAddress || "-",
        areaName: area?.name || "-",
        pincode: area?.pincode || "-",
        lastDonationDate: profile?.lastDonationDate
          ? profile.lastDonationDate.toISOString().split("T")[0]
          : "-",
        status: row.status || "PENDING",
        rejectionReason:
          row.status === "REJECTED" ? row.rejectedReason || "-" : "-",

        referredBy: ref?.referredUser
          ? ref.referredUser.profile?.name
          : ref?.type || "-",

        referrerContact: ref?.referredUser?.contact || "-",
      });
    });

    /* 🔹 Styling */
    sheet.getRow(1).font = { bold: true };

    /* 🔹 Response Headers */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=donor-report-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Excel Export Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export donor report",
    });
  }
};




const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const {
      name,
      date,
      startTime,
      endTime,
      place,
      description,
      area,
      isActive,
      completed,
      volunteers,
    } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // 🔹 Basic field updates
    if (name !== undefined) event.name = name;
    if (date !== undefined) event.date = new Date(date);
    if (startTime !== undefined) event.startTime = startTime;
    if (endTime !== undefined) event.endTime = endTime;
    if (place !== undefined) event.place = place;
    if (description !== undefined) event.description = description;
    if (area !== undefined) event.area = area;
    if (isActive !== undefined) event.isActive = isActive;
    if (completed !== undefined) event.isCompleted = completed;
    // 🔹 Volunteers update (FULL REPLACE – safest)
    if (Array.isArray(volunteers)) {
      const formattedVolunteers = volunteers
        .filter((v) => mongoose.Types.ObjectId.isValid(v.user))
        .map((v) => ({
          user: v.user,
          permissions: {
            canCall: Boolean(v.permissions?.canCall),
            canAcceptAttendance: Boolean(
              v.permissions?.canAcceptAttendance
            ),
          },
          assignedAt: new Date(),
        }));

      event.volunteers = formattedVolunteers;
    }

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event,
    });
  } catch (error) {
    console.error("Update Event Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};




const getEventPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;

    // Validate Event ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Event ID",
      });
    }

    // SUPER_ADMIN or ADMIN → full permissions
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      return res.status(200).json({
        success: true,
        permission: true,
        permissions: {
          canCall: true,
          canAcceptAttendance: true,
        },
      });
    }

    // Fetch event volunteers
    const event = await Event.findById(id)
      .select("volunteers")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // VOLUNTEER → check if present in volunteers
    if (role === "VOLUNTEER") {
      const volunteer = event.volunteers.find(
        (v) => v.user.toString() === userId.toString()
      );

      if (!volunteer) {
        return res.status(200).json({
          success: true,
          permission: false,
        });
      }

      // Return assigned permissions
      return res.status(200).json({
        success: true,
        permission: true,
        permissions: {
          canCall: volunteer.permissions.canCall,
          canAcceptAttendance: volunteer.permissions.canAcceptAttendance,
        },
      });
    }

    // USER or others → no permission
    return res.status(200).json({
      success: true,
      permission: false,
    });
  } catch (error) {
    console.error("Event Permission Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};





export { getEventReport, getEventPermission, registerUsersToEventFromFile, updateEvent, getAllEvent, getEventDetailsById, addEvent, deleteEvent, getRegisteredUsersByEvent, getUnregisteredUsersByEvent, registerUserToEvent, updateEventAttendeeStatus };
