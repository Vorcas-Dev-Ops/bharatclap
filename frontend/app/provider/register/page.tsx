import { redirect } from "next/navigation";

export default function ProviderRegisterRedirect() {
  redirect("/signup/provider");
}
