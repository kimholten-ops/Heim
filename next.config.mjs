import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  // Cacher app-skallet og statiske ressurser slik at appen åpner uansett dekning.
  // Merk: dette gir IKKE offline-skriving som synker – det krever en skrivekø (senere).
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);
