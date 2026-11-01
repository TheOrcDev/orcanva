import { redirect } from "next/navigation";

import { getViewer } from "@/lib/auth/server";
import { PRIVATE_DESIGNS_PATH, PUBLIC_DESIGNS_PATH } from "@/lib/routes";

// The studio's front door, which the landing and sign-in point at. No
// loading skeleton covers it, so this stays a real redirect: signed-in
// people start on their private designs, guests on the public ones.
const StudioPage = async () => {
  const viewer = await getViewer();
  redirect(viewer ? PRIVATE_DESIGNS_PATH : PUBLIC_DESIGNS_PATH);
};

export default StudioPage;
