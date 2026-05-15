import { redirect } from "next/dist/server/api-utils";
import SigninPage from "./(auth)/register/page";

export default function Page() {
  return <SigninPage />;
}