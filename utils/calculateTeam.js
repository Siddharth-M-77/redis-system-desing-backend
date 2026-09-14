import UserModel from "../models/user.model.js";

export const calculateTeams = async (userId) => {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const teamA = [];
  const teamB = [];
  const teamC = [];

  if (user.referedUsers && user.referedUsers.length > 0 && user.isVerified) {
    for (const refId of user.referedUsers) {
      const refUser = await UserModel.findById(refId);
      if (refUser) {
        teamA.push(refUser);
      }
    }
  }

  for (const level1User of teamA) {
    if (level1User.referedUsers && level1User.referedUsers.length > 0) {
      for (const refId of level1User.referedUsers) {
        const refUser = await UserModel.findById(refId);
        if (refUser) {
          teamB.push(refUser);
        }
      }
    }
  }

  for (const level2User of teamB) {
    if (level2User.referedUsers && level2User.referedUsers.length > 0) {
      for (const refId of level2User.referedUsers) {
        const refUser = await UserModel.findById(refId);
        if (refUser) {
          teamC.push(refUser);
        }
      }
    }
  }

  return {
    teamA: { count: teamA.length },
    teamB: { count: teamB.length },
    teamC: { count: teamC.length },
  };
};
