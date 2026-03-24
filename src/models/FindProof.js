const mongoose = require("mongoose");

const findProofSchema = new mongoose.Schema({

vehicleId:{
type:mongoose.Schema.Types.ObjectId,
ref:"LostVehicle"
},

finderId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User"
},

photo:String,

location:String,

description:String,

status:{
type:String,
enum:["pending","approved","rejected"],
default:"pending"
}

},{timestamps:true});

module.exports = mongoose.model("FindProof",findProofSchema);