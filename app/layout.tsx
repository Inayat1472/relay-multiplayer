import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Relay — Two minds. One signal.",
  description: "A cooperative circuit puzzle for two players, wherever you are. Rotate your half, guide your partner, and bring the network to life. Free to play, no sign-up.",
  metadataBase: new URL("https://relay-together.inayat121786.chatgpt.site"),
  openGraph: { title: "Relay — Two minds. One signal.", description: "You own half the circuit. Your partner owns the rest. A cooperative puzzle for two players on separate devices.", type: "website" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
