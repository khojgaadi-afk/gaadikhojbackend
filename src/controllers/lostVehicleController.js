const LostVehicle = require("../models/LostVehicle");
const { uploadToCloudinary } = require("../utils/upload"); // ✅ Cloudinary

/* =========================================================
   HELPER — Multiple files Cloudinary pe upload karo
   ========================================================= */
const uploadMultipleToCloudinary = async (files, folder) => {
  const urls = [];
  for (const file of files) {
    const url = await uploadToCloudinary(file.buffer, folder);
    urls.push(url);
  }
  return urls;
};

/* =========================================================
   USER: CREATE LOST VEHICLE
   ========================================================= */
exports.createLostVehicle = async (req, res) => {
  try {
    const {
      vehicleNumber,
      vehicleType,
      phone,
      city,
      area,
      brandModel,
      description,
      recoveryCharge,
      lat,
      lng,
    } = req.body;

    /* =========================
       VALIDATION
    ========================= */
    if (!vehicleNumber || !vehicleType || !phone || !city || !area) {
      return res.status(400).json({
        success: false,
        message: "vehicleNumber, vehicleType, phone, city and area are required",
      });
    }

    if (!req.files?.vehiclePhotos?.length) {
      return res.status(400).json({
        success: false,
        message: "At least one vehicle photo is required",
      });
    }

    /* =========================
       DUPLICATE CHECK
    ========================= */
    const existing = await LostVehicle.findOne({
      user: req.user._id,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      status: { $in: ["pending", "approved"] },
      isActive: true,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You already have an active request for this vehicle number",
      });
    }

    /* =========================
       ✅ CLOUDINARY UPLOAD
    ========================= */
    const vehiclePhotos = await uploadMultipleToCloudinary(
      req.files.vehiclePhotos,
      "gaadikhoj/lost-vehicles/photos"
    );

    const rcDocument = req.files?.rcDocument?.[0]
      ? await uploadToCloudinary(
          req.files.rcDocument[0].buffer,
          "gaadikhoj/lost-vehicles/documents"
        )
      : null;

    const firDocument = req.files?.firDocument?.[0]
      ? await uploadToCloudinary(
          req.files.firDocument[0].buffer,
          "gaadikhoj/lost-vehicles/documents"
        )
      : null;

    const aadharDocument = req.files?.aadharDocument?.[0]
      ? await uploadToCloudinary(
          req.files.aadharDocument[0].buffer,
          "gaadikhoj/lost-vehicles/documents"
        )
      : null;

    /* =========================
       CREATE DOC
    ========================= */
    const lostVehicle = await LostVehicle.create({
      user: req.user._id,

      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleType: vehicleType.trim().toLowerCase(),
      phone: phone.trim(),
      city: city.trim(),
      area: area.trim(),

      brandModel: brandModel?.trim() || "",
      description: description?.trim() || "",

      location: {
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
      },

      recoveryCharge: Number(recoveryCharge) || 0,

      // ✅ Cloudinary URLs
      vehiclePhotos,
      rcDocument,
      firDocument,
      aadharDocument,

      status: "pending",
      approvedBy: null,
      approvedAt: null,
      rejectedReason: "",
      isActive: true,

      paymentOrderId: null,
      paymentStatus: "PENDING",
      paidAt: null,
      foundAt: null,
    });

    return res.status(201).json({
      success: true,
      message: "Lost vehicle submitted successfully and sent for admin approval",
      data: lostVehicle,
    });
  } catch (error) {
    console.error("createLostVehicle error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating lost vehicle",
      error: error.message,
    });
  }
};

/* =========================================================
   PUBLIC: ONLY APPROVED ACTIVE VEHICLES
   ========================================================= */
exports.getApprovedLostVehicles = async (req, res) => {
  try {
    const { city, area, vehicleType, search } = req.query;

    const query = {
      status: "approved",
      isActive: true,
    };

    if (city) query.city = new RegExp(city, "i");
    if (area) query.area = new RegExp(area, "i");
    if (vehicleType) query.vehicleType = vehicleType.toLowerCase();

    if (search) {
      query.$or = [
        { vehicleNumber: new RegExp(search, "i") },
        { city: new RegExp(search, "i") },
        { area: new RegExp(search, "i") },
        { brandModel: new RegExp(search, "i") },
      ];
    }

    const vehicles = await LostVehicle.find(query)
      .populate("user", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error) {
    console.error("getApprovedLostVehicles error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching vehicles",
      error: error.message,
    });
  }
};

/* =========================================================
   USER: GET MY VEHICLES
   ========================================================= */
exports.getMyLostVehicles = async (req, res) => {
  try {
    const vehicles = await LostVehicle.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error) {
    console.error("getMyLostVehicles error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching your vehicles",
      error: error.message,
    });
  }
};

/* =========================================================
   ADMIN: GET ALL VEHICLES
   ========================================================= */
exports.adminGetLostVehicles = async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status && ["pending", "approved", "rejected", "found"].includes(status)) {
      query.status = status;
    }

    const vehicles = await LostVehicle.find(query)
      .populate("user", "name email")
      .populate("approvedBy", "email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error) {
    console.error("adminGetLostVehicles error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching admin vehicles",
      error: error.message,
    });
  }
};

/* =========================================================
   ADMIN: APPROVE
   ========================================================= */
exports.approveLostVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await LostVehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Lost vehicle not found",
      });
    }

    vehicle.status = "approved";
    vehicle.approvedBy = req.admin._id;
    vehicle.approvedAt = new Date();
    vehicle.rejectedReason = "";

    await vehicle.save();

    return res.status(200).json({
      success: true,
      message: "Lost vehicle approved successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("approveLostVehicle error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while approving vehicle",
      error: error.message,
    });
  }
};

/* =========================================================
   ADMIN: REJECT
   ========================================================= */
exports.rejectLostVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const vehicle = await LostVehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Lost vehicle not found",
      });
    }

    vehicle.status = "rejected";
    vehicle.approvedBy = null;
    vehicle.approvedAt = null;
    vehicle.rejectedReason = reason.trim();

    await vehicle.save();

    return res.status(200).json({
      success: true,
      message: "Lost vehicle rejected successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("rejectLostVehicle error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while rejecting vehicle",
      error: error.message,
    });
  }
};

/* =========================================================
   ADMIN: MARK FOUND
   ========================================================= */
exports.markVehicleFound = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await LostVehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Lost vehicle not found",
      });
    }

    vehicle.status = "found";
    vehicle.foundAt = new Date();
    vehicle.isActive = false;

    await vehicle.save();

    return res.status(200).json({
      success: true,
      message: "Vehicle marked as found",
      data: vehicle,
    });
  } catch (error) {
    console.error("markVehicleFound error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while marking vehicle found",
      error: error.message,
    });
  }
};