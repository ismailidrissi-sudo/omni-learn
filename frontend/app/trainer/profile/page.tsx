import { redirect } from "next/navigation";

export default function LegacyTrainerProfileRedirect() {
  redirect("/trainer");
}
