export const ENV = {
  // Für den Passwortbetrieb wird keine externe Manus-App-ID benötigt. Der
  // feste Fallback bleibt Teil der signierten Sitzungs-Payload und macht die
  // Anwendung auf einem eigenen Coolify-Server unabhängig betreibbar.
  appId:
    process.env.MYCREWMATE_APP_ID ??
    process.env.VITE_APP_ID ??
    "mycrewmate-selfhosted",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  adminRecoveryKey: process.env.ADMIN_RECOVERY_KEY ?? "",
};
