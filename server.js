const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Default to index.html for root path
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    const filePath = path.join(__dirname, pathname);
    const ext = path.extname(filePath);
    
    console.log(`📄 Request: ${req.method} ${pathname}`);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`❌ File not found: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - File Not Found</h1>');
            return;
        }
        
        // Get MIME type
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        // Add CORS headers to allow fetch requests
        const headers = {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        };
        
        // Handle OPTIONS requests (preflight)
        if (req.method === 'OPTIONS') {
            res.writeHead(200, headers);
            res.end();
            return;
        }
        
        // Read and serve the file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log(`❌ Error reading file: ${filePath}`, err);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - Internal Server Error</h1>');
                return;
            }
            
            res.writeHead(200, headers);
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log('🚀 FeetOnFocus Server Started!');
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🌐 You can also access it at: http://127.0.0.1:${PORT}`);
    console.log('');
    console.log('💡 Features Available:');
    console.log('  • Invoice Upload & Processing');
    console.log('  • AI Vision Processing (Gemini Vision API)');
    console.log('  • Text Extraction Fallback');
    console.log('  • Supplier Learning & Training');
    console.log('  • Product Database Management');
    console.log('');
    console.log('🔧 To test the new AI Vision features:');
    console.log('  1. Click "AI Settings" in the navigation');
    console.log('  2. Configure your Gemini API key');
    console.log('  3. Select "Vision AI" processing method');
    console.log('  4. Upload an invoice to test!');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
        server.listen(PORT + 1);
    } else {
        console.error('Server error:', err);
    }
});