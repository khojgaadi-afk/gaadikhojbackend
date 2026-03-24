const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    carNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
    },
    area: {
      type: String,
      required: true,
    },
    rewardAmount: {
      type: Number,
      required: true,
    },
    /* location */
    location:{
  lat:Number,
  lng:Number
},

    photoUrl: {
  type: String,
},
lat: {
  type: Number,
},
lng: {
  type: Number,
},


    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);
