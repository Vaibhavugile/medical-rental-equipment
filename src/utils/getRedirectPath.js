export function getRedirectPath(userProfile) {
  if (!userProfile) return "/";

  switch (userProfile.role) {
    case "driver":
      return "/driver/attendance";

    case "admin":
    case "staff":
    default:
      return "/crm/leads";
  }
}
