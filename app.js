// Dependencies
var http = require('http');
var io = require('socket.io');
var fs = require('fs');
var mime = require('mime');
var async = require('async');
var uuid = require('node-uuid');

// HTTP Server
var app = http.createServer(onRequest);

// Bind Socket.IO to my app
io = io.listen(app);

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
        notification.id = uuid();
        notification.roles.forEach(function (role) { io.sockets.in('ROLE:' + role).emit('notification', notification); });
        notification.users.forEach(function (user) { io.sockets.in('USER:' + user).emit('notification', notification); });
        // Respond to client
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
var serveStatic = (function () {
    var cache = {};
    return function serveStatic (req, res) {
        var path = __dirname + '/static' + req.url.replace(/\.\.\//g, '').replace(/\?.*/, '');
        function serve (content) {
            // TODO client cache headers
            res.writeHead(200, { "Content-Type": mime.lookup(path), "Content-Length": content.length });
            res.end(content);
        }
        fs.stat(path, function (err, stat) {
            if (!err) {
                if (!cache[path] || cache[path].mtime < stat.mtime) {
                    fs.readFile(path, { "encoding": "binary" }, function (err, content) {
                        // In /notifications.js, customize server address
                        if (req.url === '/notifications.js') {
                            var address = 'http://' + req.headers.host;
                            content = new Buffer(content.toString().replace(/http:\/\/localhost:8080/g, address));
                        }
                        // Cache and serve content
                        cache[path] = { "content": content, "mtime": stat.mtime };
                        serve(content);
                    });
                } else {
                    // Serve cached content
                    serve(cache[path].content);
                }
            } else {
                error404(res, path);
            }
        });
    };
})();

// WebSockets: spread notifications
io.sockets.on('connection', function (socket) {

    // Subscribe client to USER:* room
    socket.on('user_id', function (user_id, cb) {
        if (typeof user_id !== 'number') user_id = parseInt(user_id, 10);
        var onError = function (err) {
            socket.emit('error', err.toString());
            if (cb) cb();
        };
        var setId = function () {
            socket.set('user_id', user_id, function (err) {
                if (err) return onError(err);
                socket.join('USER:' + user_id, function () { if (cb) cb(user_id) });
            });
        };
        socket.get('user_id', function (err, currentId) {
            if (err) return onError(err);
            if (currentId) {
                socket.leave('USER:' + currentId, setId);
            } else {
                setId();
            }
        });
    });

    // Subscribe client to ROLE:* rooms
    socket.on('roles', function (roles, cb) {
        var onError = function (err) {
            socket.emit('error', String(err));
            if (cb) cb();
        };
        // Batch operation on roles
        var onRoles = function (roles, what, fn) {
            if (!roles || roles.length === 0) return fn();
            async.parallel(roles.map(function (role) {
                return function (cb) { socket[what]('ROLE:' + role, cb) };
            }), function (err) {
                if (err) return onError(err);
                fn();
            });
        };
        // Subscribe new roles
        var setRoles = function () {
            if (!Array.isArray(roles)) roles = [roles];
            roles = roles.map(function (r) { return String(r) }).filter(function (v) { return v.length > 0 });
            socket.set('roles', roles, function (err) {
                if (err) return onError(err);
                onRoles(roles, 'join', function () { if (cb) cb(roles) });
            });
        };
        // Unsubscribe old roles
        socket.get('roles', function (err, currentRoles) {
            if (err) return onError(err);
            onRoles(currentRoles, 'leave', setRoles);
        });

    });
});

// Start server immediately
if (!module.parent) {
    app.listen(process.env.NODE_PORT || 8080, onListen);
    function onListen () {
        console.log('Server started at ' + this.address().address + ':' + this.address().port);
    }
}

// Expose app as module
module.exports = app;
