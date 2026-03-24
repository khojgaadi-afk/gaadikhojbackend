const mongoose = require("mongoose");

const lostVehicleSchema = new mongoose.Schema({

user:{
  type:mongoose.Schema.Types.ObjectId,
  ref:"User",
  required:true
},

vehicleNumber:{
type:String,
required:true
},

vehicleType:{
type:String,
enum:["car","bike","scooter","truck"],
required:true
},

location:{
  lat:Number,
  lng:Number
},

phone:{
type:String,
required:true
},


brandModel:String,

city:String,
area:String,

description:String,

platformFee:{
type:Number,
default:299
},

vehiclePhotos:[String],

rcDocument:String,
firDocument:String,
aadharDocument:String,

status:{
type:String,
enum:["pending","approved","rejected","found"],
default:"pending"
}

},{timestamps:true});

module.exports = mongoose.model("LostVehicle",lostVehicleSchema);