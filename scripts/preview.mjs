import { preview } from "vite";

const server = await preview({
  preview: {
    host: "127.0.0.1",
    port: process.env.TEST_PORT === undefined ? 0 : Number(process.env.TEST_PORT),
    strictPort: true,
  },
  build: { outDir: process.env.TEST_DIST ?? "dist" },
});
const address = server.httpServer.address();
if (!address || typeof address === "string") throw new Error("Vite preview did not open a TCP port.");
console.log(`Preview listening on http://127.0.0.1:${address.port}`);
