import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hệ thống quản trị TriceHSK",
  description: "Hệ thống quản trị TriceHSK",
};

export default function SignIn() {
  return <SignInForm />;
}
