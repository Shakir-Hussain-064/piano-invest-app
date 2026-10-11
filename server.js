// Root entrypoint forwarding to backend/server.js
// Guarantees Render deploys successfully whether Root Directory is root or backend
require('./backend/server.js');
