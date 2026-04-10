// src/lib/mongodb.ts
// 1️⃣ MongoDB connection utility
// This file sets up a connection to MongoDB using the official MongoDB Node.js driver
// It exports a getDb function that can be used in API routes to access the database
// It also uses a global variable to cache the MongoClient connection across requests in development mode


import { MongoClient, Db, Collection } from "mongodb";

// Load from environment variables
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) throw new Error("Missing MONGODB_URI in environment variables.");
if (!dbName) throw new Error("Missing MONGODB_DB in environment variables.");

// Global caching for MongoClient (prevents multiple connections)
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const client = new MongoClient(uri);
const clientPromise = global._mongoClientPromise || (global._mongoClientPromise = client.connect());

/**
 * Get the database instance
 */
export async function getDb(): Promise<Db> {
  const mongoClient = await clientPromise;
  return mongoClient.db(dbName); // <-- ensures it's always userDB
}

/**
 * Get the 'users' collection
 */
export async function getUsersCollection(): Promise<Collection> {
  const db = await getDb();
  return db.collection("users"); // <-- all new users go here
}

/**
 * Get the 'chats' collection
 */
export async function getChatsCollection(): Promise<Collection> {
  const db = await getDb();
  return db.collection("chats"); // <-- all chats go here
}
