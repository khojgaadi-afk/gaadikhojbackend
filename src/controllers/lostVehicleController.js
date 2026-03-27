const LostVehicle = require("../models/LostVehicle");

/* =========================
   CREATE LOST VEHICLE
========================= */
exports.createLostVehicle = async (req, res) => {
  try {
    const {
      vehicleNumber,
      vehicleType,
      phone,
      brandModel,
      city,
      area,
      description,
      platformFee,
      lat,
      lng,
    } = req.body;

    if (!vehicleNumber || !vehicleType || !phone || !city || !area) {
      return res.status(400).json({
        success: false,
        message:
          "vehicleNumber, vehicleType, phone, city and area are required",
      });
    }

    /* VEHICLE PHOTOS */
    let photos = [];

    if (req.files?.photos) {
      photos = req.files.photos.map((f) => `/uploads/${f.filename}`);
    }

    if (!photos.length) {
      return res.status(400).json({
        success: false,
        message: "At least one vehicle photo is required",
      });
    }

    /* DOCUMENTS */
    const rc = req.files?.rc?.[0]
      ? `/uploads/${req.files.rc[0].filename}`
      : null;

    const fir = req.files?.fir?.[0]
      ? `/uploads/${req.files.fir[0].filename}`
      : null;

    const aadhar = req.files?.aadhar?.[0]
      ? `/uploads/${req.files.aadhar[0].filename}`
      : null;

    const latNum = lat !== undefined ? Number(lat) : null;
    const lngNum = lng !== undefined ? Number(lng) : null;

    /* CREATE VEHICLE */
    const vehicle = await LostVehicle.create({
      user: req.user._id || req.user.id,

      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleType: vehicleType.trim().toLowerCase(),
      phone: phone.trim(),
      brandModel: brandModel?.trim() || "",
      city: city.trim(),
      area: area.trim(),
      description: description?.trim() || "",
      platformFee: Number(platformFee) || 299,

      location: {
        lat: isNaN(latNum) ? null : latNum,
        lng: isNaN(lngNum) ? null : lngNum,
      },

      vehiclePhotos: photos,

      rcDocument: rc,
      firDocument: fir,
      aadharDocument: aadhar,

      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Lost vehicle reported successfully",
      vehicle,
    });
  } catch (err) {
    console.error("❌ Create lost vehicle error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

/* =========================
   PUBLIC LIST (APP USERS)
========================= */
exports.getLostVehicles = async (req, res) => {
  try {
    const vehicles = await LostVehicle.find({
      status: "approved",
    })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      vehicles,
    });
  } catch (err) {
    console.error("❌ Get vehicles error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================
   ADMIN PENDING LIST
========================= */
exports.getPendingLostVehicles = async (req, res) => {
  try {
    const vehicles = await LostVehicle.find({
      status: "pending",
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      vehicles,
    });
  } catch (err) {
    console.error("❌ Pending vehicles error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================
   ADMIN VERIFY / UPDATE STATUS
========================= */
exports.verifyLostVehicle = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected", "found"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const vehicle = await LostVehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    /*
      RULES:
      pending  -> approved / rejected
      approved -> found
    */

    if (vehicle.status === "pending") {
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Pending vehicle can only be approved or rejected",
        });
      }
    }

    if (vehicle.status === "approved") {
      if (status !== "found") {
        return res.status(400).json({
          success: false,
          message: "Approved vehicle can only be marked as found",
        });
      }
    }

    if (["rejected", "found"].includes(vehicle.status)) {
      return res.status(400).json({
        success: false,
        message: "Vehicle already finalized",
      });
    }

    vehicle.status = status;
    await vehicle.save();

    return res.json({
      success: true,
      message: "Vehicle status updated successfully",
      vehicle,
    });
  } catch (err) {
    console.error("❌ Verify vehicle error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};