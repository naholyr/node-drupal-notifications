// Dependencies
var http = require('http');
var io = require('socket.io');

// HTTP Server
var app = http.createServer(onRequest);

// HTTP request handler
function onRequest (req, res) {
    // New notification pushed ?
    if (req.url === '/' && req.method === 'POST') {
        newNotification(req, res);
    }
    // Serve static content ?
    else {
        serveStatic(req, res);
    }
}

// Receive and store new notification
function newNotification (req, res) {
    // Validate request
    if (req.headers['content-type'] !== 'application/json') {
        error(res, 400, 'CONTENT_TYPE_JSON', 'Invalid content type: expected application/json');
    }
    // Read request body
    var body = '';
    req.on('data', function (chunk) { body += chunk.toString(); });
    req.on('end', function () {
        var notification;
        // Parse JSON
        try {
            notification = JSON.parse(body);
        } catch (err) {
            return error(res, 400, 'INVALID_JSON', err.toString());
        }
        // Additional keys
        var invalidKeys = Object.keys(notification).reduce(function (list, key) {
            return ~["roles", "users", "message"].indexOf(key) ? list : list.concat([key]);
        }, []);
        if (invalidKeys.length) return error(res, 400, 'INVALID_KEYS', 'Invalid keys: ' + invalidKeys.join(', '));
        // Mandatory keys
        if (typeof notification.message === 'undefined') return error(res, 400, 'MISSING_MESSAGE', 'Mandatory key: message');
        if (typeof notification.roles === 'undefined' && notification.users === 'undefined') return error(res, 400, 'MISSING_TARGET', 'Mandatory key: users or roles');
        // User IDs
        if (typeof notification.users === 'undefined') notification.users = [];
        if (!Array.isArray(notification.users)) notification.users = [notification.users];
        notification.users = notification.users.map(function (u) { return typeof u !== 'number' ? parseInt(u, 10) : u });
        if (notification.users.some(isNaN)) return error(res, 400, 'INVALID_USER_ID', 'One or more user ID is not a valid number');
        // Role names
        if (typeof notification.roles === 'undefined') notification.roles = [];
        if (!Array.isArray(notification.roles)) notification.roles = [notification.roles];
        notification.roles = notification.roles.map(function (u) { return u && u.toString() }).filter(function (v) { return v });
        // Message
        notification.message = notification.message.toString();
        // Spread notification
        content = JSON.stringify(notification) + "\n";
        res.writeHead(201, { "Content-Type": "application/json", "Content-Length": content.length });
        res.end(content);
    });
    req.on('error', function (err) {
        error(res, 500, 'UNEXPECTED_ERROR', 'Unexpected error while reading request body: ' + err.toString());
    });
}

// HTTP: Error
function error (res, status, code, message) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ "code": code, "message": message }));
}
function error404 (res, message) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(message || "Resource not found");
}

// HTTP: serve static file
function serveStatic (req, res) {
    if (req.url === '/notifications.js') {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end('var notifications={"display":function(){alert("Not implemented yet");}};');
    } else {
        error404(res);
    }
}

// Start server immediately
if (!module.parent) {
    app.listen(process.env.NODE_PORT || 8080, onListen);
    function onListen () {
        console.log('Server started at ' + this.address().address + ':' + this.address().port);
    }
}

// Expose app as module
module.exports = app;
