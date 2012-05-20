(function (w, socketIOServer) {
    n = {};
    // Add some JS
    var addedJS = {};
    function addJS (path, options) {
        if (addedJS[path]) return;
        addedJS[path] = true;
        var th = document.getElementsByTagName('head')[0];
        var s = document.createElement('script');
        s.setAttribute('type','text/javascript');
        s.setAttribute('src', path);
        th.appendChild(s);
    }
    // Wait for "io"
    function waitDefined (object, key, cb) {
        (function check () {
            if (typeof object[key] !== 'undefined') {
                cb(object[key]);
            } else {
                setTimeout(check, 25);
            }
        })();
    }
    // Initialize WebSocket
    function initSocket (options, cb) {
        var address = (options && options.socketIOServer) || socketIOServer;
        if (address !== false) {
            addJS(address + '/socket.io/socket.io.js');
        }
        waitDefined(window, 'io', function (io) {
            var socket = io.connect((options && options.socketIOServer) || socketIOServer);
            socket.on('error', function (err) {
                console.error('ERROR', err);
            });
            cb(socket);
        })
    }
    // Work with WebSocket and display notifications
    function display (user_id, roles, options) {
        initSocket(options, function (socket) {
            socket.on('connect', function () {
                console.log('CONNECTED');
                // Send user_id
                socket.emit('roles', roles, function (roles) {
                    console.log('ROLES', roles);
                });
                // Send user roles
                socket.emit('user_id', user_id, function (user_id) {
                    console.log('USER ID', user_id);
                });
            });
            // Lost connection
            socket.on('disconnect', function () {
                console.error('DISCONNECTED');
            });
            // Receive notification
            socket.on('notification', function (notification) {
                console.warn('NOTIFICATION', notification);
            });
        });
    }
    w.notifications = { "display": display };
})(window, 'http://localhost:8080');
