(function (w, host) {
    n = {};

    // Add some JS
    var addedJS = {};
    function addJS (path) {
        if (addedJS[path]) return;
        addedJS[path] = true;
        var s = document.createElement('script');
        s.setAttribute('type','text/javascript');
        s.setAttribute('src', path);
        document.getElementsByTagName('head')[0].appendChild(s);
    }

    // Add some CSS
    var addedCSS = false;
    function addCSS (path) {
        if (addedCSS[path]) return;
        addedCSS[path] = true;
        var s = document.createElement("link");
        s.setAttribute("rel", "stylesheet");
        s.setAttribute("type", "text/css");
        s.setAttribute("href", path);
        document.getElementsByTagName('head')[0].appendChild(s);
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

    // DOMNode builder
    function newDOMNode (tagName, content, attributes) {
        // Support calling (tagName, content) and (tagName, attributes)
        if (typeof attributes === 'undefined') {
            if (typeof content === 'object') {
                // called (tagName, attributes)
                attributes = content;
                content = '';
            } else {
                // called (tagName, content)
                attributes = {};
            }
        }
        // Support direct string as attribute = className
        if (typeof attributes === 'string') {
            attributes = { "class": attributes };
        }
        // Build node
        var node = document.createElement(tagName);
        node.innerText = content;
        for (var attr in attributes) {
            if (attr === 'class') {
                node.className = attributes[attr];
            } else {
                node.setAttribute(attr, attributes[attr]);
            }
        }
        return node;
    }

    // className manipulation
    function removeClassName (node, className) {
        node.className = node.className.split(/ +/).reduce(function (fullClassName, cls) {
            if (cls !== className) {
                if (fullClassName !== '') fullClassName += ' ';
                fullClassName += cls;
            }
            return fullClassName;
        }, '');
        return node;
    }
    function addClassName (node, className) {
        removeClassName(node, className);
        if (node.className !== '') node.className += ' ';
        node.className += className;
        return node;
    }

    // Add notifications DOM container
    var container = null;
    function addContainer () {
        if (!container) {
            container = newDOMNode('div', '', { "class": "notifications-container notifications-container-hidden", "style": "display:none" });
            document.getElementsByTagName('body')[0].appendChild(container);
            setTimeout(function () { container.style.display = '' }, 20);
        }
        return container;
    }

    // Add auto-disappearing notification DOM node
    function addNotification (notification, level, timeout) {
        // Format notification
        if (typeof notification !== 'object') {
            notification = { "message": notification.toString() }
        }
        if (typeof notification.date === 'undefined') {
            notification.date = new Date();
        } else if (typeof notification.date === 'number') {
            notification.date = new Date(notification.date);
        }
        // Insert DOM
        var container = addContainer();
        var main = newDOMNode('div', '', "notifications-item notifications-item-hidden notifications-item-level-" + level);
        main.appendChild(newDOMNode('small', notification.date.toString(), "notifications-item-date"));
        main.appendChild(newDOMNode('span', notification.message, "notifications-item-message"));
        // Append notification DOM
        if (container.childNodes.length === 0) {
            container.appendChild(main);
        } else {
            container.insertBefore(main, container.childNodes[0]);
        }
        setTimeout(function () { removeClassName(main, 'notifications-item-hidden') }, 20);
        // Display container
        removeClassName(container, 'notifications-container-hidden');
        container.style.display = 'block';
        // Automatically remove child
        setTimeout(function () {
            // Hide child, then remove it a few seconds later
            addClassName(main, 'notifications-item-hidden');
            setTimeout(function () {
                container.removeChild(main);
                // Hide container if no remaining notification
                setTimeout(function () {
                    if (container.childNodes.length === 0) {
                        addClassName(container, 'notifications-container-hidden');
                    }
                }, 20);
            }, 2000);
        }, timeout || 30000);
    }

    // Work with WebSocket and display notifications
    function display (user_id, roles, options) {
        options = options || {};
        addJS(options.socketIOJs || ((options.socketIOServer || host) + '/socket.io/socket.io.js'));
        addCSS(options.css || ((options.staticServer || host) + '/notifications.css'));
        addContainer();
        waitDefined(window, 'io', function (io) {
            // Connect WebSocket
            var socket = io.connect((options && options.socketIOServer) || host);
            var disconnected = false;
            socket.on('connect', function () {
                if (disconnected) addNotification("Successfully reconnected to notification service", 'success', options.notificationTimeout);
                disconnected = false;
                // Send user_id
                socket.emit('roles', roles, function (roles) {
                    console.log('ROLES', roles); // TODO ?
                });
                // Send user roles
                socket.emit('user_id', user_id, function (user_id) {
                    console.log('USER ID', user_id); // TODO ?
                });
            });
            // Receive error
            socket.on('error', function (err) {
                addNotification("Communication error: " + err.toString(), 'error', options.notificationTimeout);
            });
            // Lost connection
            socket.on('disconnect', function () {
                addNotification("You've been disconnected to notification service", 'error', options.notificationTimeout);
                disconnected = true;
            });
            // Receive notification
            socket.on('notification', function (notification) {
                addNotification(notification, 'info', options.notificationTimeout);
            });
        });
    }

    w.notifications = { "display": display };

})(window, 'http://localhost:8080');
