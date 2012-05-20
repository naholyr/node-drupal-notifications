node-drupal-notifications
=========================

Node.JS+Socket.IO server and client to allow realtime notifications (demoed with Drupal, but generic purpose)

*WARNING* THIS IS NOT PRODUCTION READY. I mean, really not. Don't read "I'm a hipster and like to say my work is not production-ready", but read "this will inject HTML to your admin interface, with no filter on this HTML, and with no filter on who can add new notifications".

If you put it in production, anyone who can POST to your IP (so, anyone) could simply add a notification that grabs user's cookie, and trick the WebSocket client to push back this information to his browsers. You really want this to happen ?

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
<script>
  notifications.display(USER_ID, [ USER_ROLES ]);
</script>
```

Client API will be enhanced to provide events to handle errors, received notifications, etc. But not today.
