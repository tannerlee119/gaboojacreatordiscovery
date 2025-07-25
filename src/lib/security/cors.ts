import { NextResponse } from 'next/server';

interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const defaultCorsOptions: CorsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://www.yourdomain.com'] // Update with your actual domain
    : true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export function setCorsHeaders(response: NextResponse, options: CorsOptions = {}): NextResponse {
  const corsOptions = { ...defaultCorsOptions, ...options };
  
  // Set CORS headers
  if (corsOptions.origin) {
    if (typeof corsOptions.origin === 'boolean' && corsOptions.origin) {
      response.headers.set('Access-Control-Allow-Origin', '*');
    } else if (typeof corsOptions.origin === 'string') {
      response.headers.set('Access-Control-Allow-Origin', corsOptions.origin);
    } else if (Array.isArray(corsOptions.origin)) {
      // In a real implementation, you'd check the request origin against allowed origins
      response.headers.set('Access-Control-Allow-Origin', corsOptions.origin[0]);
    }
  }
  
  if (corsOptions.methods) {
    response.headers.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  }
  
  if (corsOptions.allowedHeaders) {
    response.headers.set('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  }
  
  if (corsOptions.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  if (corsOptions.maxAge) {
    response.headers.set('Access-Control-Max-Age', corsOptions.maxAge.toString());
  }
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}

export function handleCorsPreFlight(): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response);
} 