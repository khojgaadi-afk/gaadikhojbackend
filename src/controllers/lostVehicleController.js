const LostVehicle = require("../models/LostVehicle");

/* CREATE LOST VEHICLE */

exports.createLostVehicle = async(req,res)=>{

try{

const {
vehicleNumber,
vehicleType,
phone,
brandModel,
city,
area,
description
} = req.body;


/* VEHICLE PHOTOS */

let photos = [];

if(req.files?.photos){
photos = req.files.photos.map(
f=>`/uploads/${f.filename}`
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

userId:req.user._id,

vehicleNumber,
vehicleType,
phone,
brandModel,
city,
area,
description,

vehiclePhotos:photos,

rcDocument:rc,
firDocument:fir,
aadharDocument:aadhar

});

res.status(201).json(vehicle);

}catch(err){

console.log(err);

res.status(500).json({
message:err.message
});

}

};



/* PUBLIC TASKS (APP USERS) */

exports.getLostVehicles = async(req,res)=>{

try{

const vehicles = await LostVehicle.find({
status:"approved"
})
.sort({createdAt:-1});

res.json(vehicles);

}catch(err){

res.status(500).json({
message:err.message
});

}

};



/* ADMIN PENDING LIST */

exports.getPendingLostVehicles = async(req,res)=>{

try{

const vehicles = await LostVehicle.find({
status:"pending"
})
.populate("userId","name email")
.sort({createdAt:-1});

res.json(vehicles);

}catch(err){

res.status(500).json({
message:err.message
});

}

};



/* ADMIN VERIFY */

exports.verifyLostVehicle = async(req,res)=>{

try{

const vehicle = await LostVehicle.findById(req.params.id);

if(!vehicle){

return res.status(404).json({
message:"Vehicle not found"
});

}

vehicle.status = req.body.status;

await vehicle.save();

res.json(vehicle);

}catch(err){

res.status(500).json({
message:err.message
});

}

};