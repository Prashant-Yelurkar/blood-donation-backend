import User from "../models/authuser.model.js";
import Call from "../models/call.model.js";
import Event from "../models/event.model.js";
import EventAttendee from "../models/eventAttended.model.js";

const getMainDashboardSummary = async (req, res) => {
  try {
    const [
      totalEvents,
      activeEvents,
      totalUsers,
      totalCalls,
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ isActive: true }),
      User.countDocuments(),
      Call.countDocuments(),
    ]);

    /* ======================
       ATTENDEE STATS
    ======================= */
    const attendeeStats = await EventAttendee.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    let totalRegistered = 0;
    let totalDonated = 0;
    let totalRejected = 0;
    let totalPending = 0;

    attendeeStats.forEach((s) => {
      totalRegistered += s.count;
      if (s._id === "DONATED") totalDonated = s.count;
      if (s._id === "REJECTED") totalRejected = s.count;
      if (s._id === "PENDING") totalPending = s.count;
    });

    /* ======================
       BLOOD GROUP DISTRIBUTION
       (ONLY DONATED)
    ======================= */
    const bloodGroupDistribution = await EventAttendee.aggregate([
      { $match: { status: "DONATED" } },
      {
        $lookup: {
          from: "AuthUser",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "userProfile",
          localField: "user.profile",
          foreignField: "_id",
          as: "profile",
        },
      },
      { $unwind: "$profile" },
      {
        $group: {
          _id: "$profile.bloodGroup",
          count: { $sum: 1 },
        },
      },
    ]);

    /* ======================
       REJECTION REASONS
    ======================= */
    const rejectionReasons = await EventAttendee.aggregate([
      { $match: { status: "REJECTED", rejectedReason: { $ne: "" } } },
      {
        $group: {
          _id: "$rejectedReason",
          count: { $sum: 1 },
        },
      },
    ]);

    /* ======================
       RECENT EVENTS (OPTIONAL)
    ======================= */
    const recentEvents = await Event.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name date place isActive");

    /* ======================
       RESPONSE
    ======================= */
    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalEvents,
          activeEvents,
          totalUsers,
          totalRegistered,
          totalDonated,
          totalRejected,
          totalPending,
          totalCalls,
        },

        charts: {
          bloodGroupDistribution,
          rejectionReasons,
        },

        recentEvents,
      },
    });
  } catch (error) {
    console.error("Main Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export{getMainDashboardSummary}