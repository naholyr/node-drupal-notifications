node-drupal-notifications
=========================

Node.JS+Socket.IO server and client to allow realtime notifications (demoed with Drupal, but generic purpose)

*WARNING* THIS IS NOT PRODUCTION READY. I mean, really not. Don't read "I'm a hipster and like to say my work is not production-ready", but read "this will inject HTML to your admin interface, with no filter on this HTML, and with no filter on who can add new notifications".

If you put it in production, anyone who can POST to your IP (so, anyone) could simply add a notification that grabs user's cookie, and trick the WebSocket client to push back this information to his browsers. You really want this to happen ?

Sample output
-------------

![](http://github.com/naholyr/node-drupal-notifications/raw/master/screenshot.png)

Spread new notification
-----------------------

`POST` a new request to `http://server/` with Content-Type `application/json`:

```sh
curl -i -H "Content-Type: application/json" -X POST -d '{"roles":["admin","guest"],"message":"hello, world"}'  'http://localhost:8080'
```

Server will respond with `201 - Created`, or raise an error (codes `4xx` or `5xx`) with a JSON body:

```javascript
{
  "code":    "ERROR_CODE",
  "message": "Error message"
}
```

You can send this JSON body:

```javascript
{
  "roles":    [ ... list roles by name ... ],  // non mandatory
  "users":    [ ... list users by id ... ],    // non mandatory
  "message":  "message (HTML)",                // mandatory
}
```

Display notifications
---------------------

Insert script:

```html
<script src="http://server/notifications.js"></script>
```

Then in your JS call `notifications.display` to start dispatching notifications on-screen:

```javascript
notifications.display(USER_ID, USER_ROLES);
```

You will display all (and only) notifications sent to your user id or your roles.

Client API will be enhanced to provide events to handle errors, received notifications, etc. But not today.

Security
--------

There is no security, every possible flaw you can think of is here.

* There is no way to prevent a user to add any role or declare any user id and therefore receive notifications not related to his status.
* There is no escaping, anywhere, just brutal typecasts.
* The worst is the absence of escaping in notifications message.

> WTF dude, the time you took to write this, you could have fixed that mess !

True, but it would add code, and may make the demonstration less clear. Just live with that.
