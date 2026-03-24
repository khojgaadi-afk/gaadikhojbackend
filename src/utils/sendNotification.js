const axios = require("axios");

exports.sendNotification = async(token,title,body)=>{

await axios.post(
"https://exp.host/--/api/v2/push/send",
{
to: token,
sound: "default",
title: title,
body: body
}
);

};