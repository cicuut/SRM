import { redirect } from "next/dist/server/api-utils";
import Login from "./(auth)/login/page";

export default function Page() {
  return <Login />;
}
