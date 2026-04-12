import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beverly Girls Softball League",
    short_name: "BGSL",
    description:
      "Softball team schedule, attendance, communication, and lineup planning.",
    start_url: "/schedule",
    display: "standalone",
    background_color: "#f4f1eb",
    theme_color: "#f07d19",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
