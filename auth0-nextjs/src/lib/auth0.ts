import { Auth0Client } from '@auth0/nextjs-auth0/server';

//creates and exports Auth0 Clients
//Auth0 SDK instance
export const auth0 = new Auth0Client();