function getProfile(req, res) {
  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully.",
    data: {
      user: req.user
    }
  });
}

function getAdminOnlyResource(_req, res) {
  return res.status(200).json({
    success: true,
    message: "Welcome, admin.",
    data: {
      feature: "Sensitive admin analytics"
    }
  });
}

module.exports = {
  getProfile,
  getAdminOnlyResource
};
