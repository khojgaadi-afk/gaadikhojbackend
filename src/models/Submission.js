const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
{
  postId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Post",
    required:true
  },

  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true
  },

  photoUrl:{
    type:String,
    required:true
  },

  notes:{
    type:String
  },

  lat:Number,
  lng:Number,

  status:{
    type:String,
    enum:["pending","approved","rejected"],
    default:"pending"
  },

  verifiedBy:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Admin"
  }

},
{timestamps:true}
);

module.exports = mongoose.model("Submission",submissionSchema);