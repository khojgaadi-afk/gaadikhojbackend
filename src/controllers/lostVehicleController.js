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
    } = req.body;

    if (!vehicleNumber || !vehicleType || !phone) {
      return res.status(400).json({
        message: "vehicleNumber, vehicleType and phone are required",
      });
    }

    /* VEHICLE PHOTOS */
    let photos = [];

    if (req.files?.photos) {
      photos = req.files.photos.map(
        (f) => `/uploads/${f.filename}`
      );
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

    /* CREATE VEHICLE */
    const vehicle = await LostVehicle.create({
      user: req.user._id, // ✅ FIXED

      vehicleNumber,
      vehicleType,
      phone,
      brandModel,
      city,
      area,
      description,

      vehiclePhotos: photos,

      rcDocument: rc,
      firDocument: fir,
      aadharDocument: aadhar,
    });

    res.status(201).json(vehicle);
  } catch (err) {
    console.error("❌ Create lost vehicle error:", err);

    res.status(500).json({
      message: err.message,
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
      .populate("user", "name") // optional
      .sort({ createdAt: -1 });

    res.json(vehicles);
  } catch (err) {
    console.error("❌ Get vehicles error:", err);

    res.status(500).json({
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
      .populate("user", "name email") // ✅ FIXED
      .sort({ createdAt: -1 });

    res.json(vehicles);
  } catch (err) {
    console.error("❌ Pending vehicles error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

/* =========================
   ADMIN VERIFY
========================= */
exports.verifyLostVehicle = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected", "found"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const vehicle = await LostVehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    if (vehicle.status !== "pending") {
      return res.status(400).json({
        message: "Already processed",
      });
    }

    vehicle.status = status;

    await vehicle.save();

    res.json({
      message: "Vehicle status updated",
      vehicle,
    });
  } catch (err) {
    console.error("❌ Verify vehicle error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};