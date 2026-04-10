//User logs in with Google
// ↓
//Redirected to this route (/post-login)
// ↓
//Check if user exists in DB
// ↓
//YES → send to app
//NO  → send to register page


import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getUsersCollection } from "@/lib/mongodb";


//get frontend and backend URLs
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3001";

//gets logged-in user's email
export async function GET() {
  const session = await auth0.getSession();
  const email = session?.user?.email?.toLowerCase().trim();

//if no email, redirect to registration page
  if (!email) {
    return NextResponse.redirect(`${FRONTEND_BASE_URL}/register`);
  }

//check MongoDB for user with that email
  try {
    const users = await getUsersCollection();
    const existingUser = await users.findOne({ email });
    //if user exists, redirect to /api/poc-sync
    if (existingUser) {
      return NextResponse.redirect(`${APP_BASE_URL}/api/poc-sync`);
    }

  } catch (error) {
    console.error("post-login user lookup failed:", error);
  }

  //if user does NOT exist, prepare data for registration
  const fullName = session?.user?.name || "";
  const encodedEmail = encodeURIComponent(email);
  const encodedFullName = encodeURIComponent(fullName);

  //redirect to register page 
  return NextResponse.redirect(
    `${FRONTEND_BASE_URL}/register?email=${encodedEmail}&fullName=${encodedFullName}`
  );
}
