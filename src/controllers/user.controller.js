import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    // the mistake was not writing accese token env in user model while
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something Went Wrong while generating tokens.");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  //validation
  //check if already exist by: email, username
  //check for images/avatar
  //check multer did it correctly
  //upload them in cloudinary
  //create user object for create entry in db
  //remove password and refresh token from password
  //check for user creation
  //return res(response)

  const { fullName, email, password, username } = req.body;
  console.log("email: ", email);

  if (
    [fullName, email, password, username].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(
      400,
      "Fullname, password, email and username are required."
    );
  }

  const ifUserExist = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (ifUserExist) {
    throw new ApiError(409, "User with same email or username already exists");
  }
  console.log(req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is requred");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is requred");
  }

  const newUser = await User.create({
    fullName,
    avatar: avatar?.url || "",
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something Went wrong while registering.");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //get email, password from req.body
  //find user with email
  //check password
  //generate access and refresh token
  //send tokens to cookie

  const { email, password } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required!");
  }
  const user = await User.findOne({ email });
  // //#for findOne by username or email
  //await User.findOne({
  //   $or :[{email},{username}]
  // })

  if (!user) {
    throw new ApiError(404, "User doesn't exist!");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password Invalid");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully."
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  const findUser = User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized access.");
  }
  try {
    const decodeToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodeToken._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token invalid.");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refresh succesfull."
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isOldPasswordCorrect) {
    throw new ApiError(400, "Invalid old password.");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully."));
});

const getCurrentUser = asyncHandler(async (req, res, next) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

//text based data update
const updateAcountDetails = asyncHandler(async (req, res, next) => {
  const data = req.body;
  if (!data) {
    throw new ApiError(401, "Data required.");
  }
  const updateDoc = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        ...data,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  return res
    .status(200)
    .json(
      new ApiResponse(200, req.user, "Account details updated successfully.")
    );
});

//files type data update
const updateUserCoverImage = asyncHandler(async (req, res, next) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Avatar is missing.");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage?.url) {
    throw new ApiError(400, "Error occured while updating cover.");
  }

  const user = await User.findById(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res, next) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is missing.");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar?.url) {
    throw new ApiError(400, "Error occured while updating avatar.");
  }

  const user = await User.findById(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAcountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
