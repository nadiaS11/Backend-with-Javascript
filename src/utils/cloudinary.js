import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.API_CLOUD_NAME,
  api_key: process.env.API_API_KEY,
  api_secret: process.env.API_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file uploaded successfully
    console.log("File uploaded successfully at: ", response.url);

    return response;
  } catch (err) {
    console.log(err);
    fs.unlinkSync(localFilePath); //remove the file from server in case error while uploading
  }
};

export { uploadOnCloudinary };
