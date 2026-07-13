// Sider gjester (household_role "gjest") ikke skal se i navigasjon eller
// snarveier — RLS håndhever det samme på databasenivå (0015_guest_access.sql).
export const GUEST_HIDDEN_HREFS = new Set(["/app/lister", "/app/gjoremal"]);
