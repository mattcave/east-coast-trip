import { cookies } from "next/headers";
import { readPins } from "@/lib/pins";
import { isValidToken } from "@/lib/auth";
import TripMap from "@/components/TripMap";

export const metadata = {
  title: "East Coast Trip",
  description: "Our east coast Canada road trip",
};

export default async function Home() {
  const pins = await readPins();

  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const isAuthenticated = await isValidToken(token).catch(() => false);

  return (
    <main className="w-full h-screen">
      <TripMap
        initialPins={pins}
        isAuthenticated={isAuthenticated}
      />
    </main>
  );
}
