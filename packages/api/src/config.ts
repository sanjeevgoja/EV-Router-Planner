function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://evrouter:evrouter@localhost:5432/evrouter"
  ),
  valhallaUrl: process.env.VALHALLA_URL ?? "http://localhost:8002",
  photonUrl: process.env.PHOTON_URL ?? "http://localhost:2322",
  nrelApiKey: process.env.NREL_API_KEY ?? "DEMO_KEY",
  ocmApiKey: process.env.OCM_API_KEY ?? "",
  eiaApiKey: process.env.EIA_API_KEY ?? "",
};
