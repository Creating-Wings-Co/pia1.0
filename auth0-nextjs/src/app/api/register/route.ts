
//This file is used to handle CORS and POST requests 


import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

//sets the allowed URLS (can change later on when deploying)
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
const LOCAL_FRONTEND_URL = "http://localhost:3000";

//builds a set of allowed origins for CORS
function getAllowedOrigins() {
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([FRONTEND_BASE_URL, LOCAL_FRONTEND_URL, ...envOrigins]);
}

//CORS header function
//gets incoming request's origin header and checks whether the origin is the allowed list
function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = allowedOrigins.has(origin) ? origin : FRONTEND_BASE_URL;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

//OPTIONS handler 
//handles browser preflight requests
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

// 5️⃣ API route to handle registration form submission
// This route receives the registration data from the frontend, validates it, and saves it to MongoDB
// It also handles CORS preflight requests and sets appropriate headers for cross-origin requests
export async function POST(request: Request) {
  try {
    const body = await request.json();    //read and normalize request body
    const email = String(body?.email || "").trim().toLowerCase();   //extracts email 
    const fullName = body?.fullName ? String(body.fullName).trim() : null;  //extracts fullName
    const location = body?.location ? String(body.location).trim() : "";  //extracts location
    const maritalStatus = body?.maritalStatus ? String(body.maritalStatus).trim() : null;   //extracts marital status
    const householdIncomeRange = body?.householdIncomeRange   //extracts household income range
      ? String(body.householdIncomeRange).trim()
      : null;
    const educationLevel = body?.educationLevel ? String(body.educationLevel).trim() : null;    //extracts edu level
    const employmentStatus = body?.employmentStatus   //extracts employment status
      ? String(body.employmentStatus).trim()
      : null;
    const acceptedTerms = body?.acceptedTerms === true;   //extracts terms bool
    const is18OrOlder = body?.is18OrOlder === true;   //extracts is older than 18 bool

    if (!email || !location || !acceptedTerms || !is18OrOlder) {    //sends error msg if missing email, location, accepted terms, or is older than 18
      return NextResponse.json(
        { message: "email, location, acceptedTerms=true, and is18OrOlder=true are required" },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    //CONNECT TO MONGO DB
    const db = await getDb();
    const users = db.collection("users");

    //saves data with updateOne + upsert 
    await users.updateOne(
      { email },
      {
        $set: {
          email,
          fullName,
          location,
          maritalStatus,
          householdIncomeRange,
          educationLevel,
          employmentStatus,
          acceptedTerms,
          is18OrOlder,
        },
      },
      { upsert: true }    //if email does not exist, create new user
    );

    //error handling 
    return NextResponse.json(
      { ok: true, message: "Registration saved" },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    const message =
      status === 400 ? "Invalid request body" : "Database connection failed";

    return NextResponse.json(
      { message },
      { status, headers: corsHeaders(request) }
    );
  }
}
