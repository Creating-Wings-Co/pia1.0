import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getUsersCollection } from "@/lib/mongodb";

const POC_BASE_URL = process.env.POC_BASE_URL || "http://localhost:8000";

export async function GET() {
  const session = await auth0.getSession();
  const user = session?.user;

  // uses environemnt variable if needed, otherwise default to localhost
  if (!user?.email || !user?.sub) {
    return NextResponse.redirect(
      `${process.env.FRONTEND_BASE_URL || "http://localhost:3000"}/login`
    );
  }

  //cleans email
  const email = user.email.toLowerCase().trim();


  //get user data from MongoDB by finding user by email
  let registrationDoc: Record<string, unknown> | null = null;
  try {
    const users = await getUsersCollection();
    registrationDoc = (await users.findOne({ email })) as Record<string, unknown> | null;
  } catch (error) {
    console.error("Failed to load registration profile from Mongo:", error);
  }

  //build payload to send to POC backend, using data from Auth0 and MongoDB
  const payload = {
    sub: user.sub,
    name: String(
      registrationDoc?.fullName ||
      user.name ||
      email
    ),
    email,
    picture: user.picture || null,
    income_range: registrationDoc?.householdIncomeRange || null,
    employment_status: registrationDoc?.employmentStatus || null,
    marital_status: registrationDoc?.maritalStatus || null,
    education: registrationDoc?.educationLevel || null,
    location: registrationDoc?.location || null,
    username: null,
    phone: null,
    age: null,
    financial_goals: null,
    dependents: null,
    investment_experience: null,
    risk_tolerance: null,
  };

  //send data to external backend
  try {
    const response = await fetch(`${POC_BASE_URL}/api/auth/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("POC sync failed:", response.status, text);
      return NextResponse.json(
        { message: "Failed to sync user to POC backend" },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!data?.user_id) {
      console.error("POC sync returned unexpected payload:", data);
      return NextResponse.json(
        { message: "POC backend did not return user_id" },
        { status: 502 }
      );
    }

    //REDIRECT user to backend 
    return NextResponse.redirect(`${POC_BASE_URL}/?userId=${data.user_id}`);
  } catch (error) {
    console.error("Error calling POC backend:", error);
    return NextResponse.json(
      { message: "Unable to reach POC backend" },
      { status: 502 }
    );
  }
}
