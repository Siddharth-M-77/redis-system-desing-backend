import UserModel from "../models/user.model.js";

/**
 * Add business to correct side (LEFT / RIGHT) till ROOT
 */
export const propagateBinaryBusiness = async (childUser, amount, session) => {
  let currentChild = childUser;

  while (currentChild?.sponserId) {
    const parent = await UserModel.findById(currentChild.sponserId).session(
      session
    );
    if (!parent) break;

    let update = null;

    // 🔥 check placement side
    if (parent.left?.toString() === currentChild._id.toString()) {
      update = {
        $inc: {
          leftBusiness: amount,
          totalBusiness: amount,
        },
      };
    } else if (parent.right?.toString() === currentChild._id.toString()) {
      update = {
        $inc: {
          rightBusiness: amount,
          totalBusiness: amount,
        },
      };
    } else {
      break;
    }

    await UserModel.updateOne({ _id: parent._id }, update, { session });

    // move one level up
    currentChild = parent;
  }
};
