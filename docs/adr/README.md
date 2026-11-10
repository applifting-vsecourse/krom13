# Architecture decision records

Check this index before changing the data model or the structure of the app.

| #                                           | Title                                    | Status                           | In one sentence                                                                                              |
| ------------------------------------------- | ---------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [0001](0001-feed-search.md)                 | Feed search                              | accepted                         | The feed can be searched by text, author name and username, with the filter applied on the server.           |
| [0002](0002-polls.md)                       | Polls in quacks                          | accepted                         | A quack can carry a poll; counts come from vote rows and one person gets one vote, enforced by the database. |
| [0003](0003-delete-own-quacks.md)           | Delete own quacks                        | accepted (admin rule superseded) | Authors can hard-delete their own quacks; ownership is checked inside the delete statement.                  |
| [0004](0004-moderator-deletes-any-quack.md) | Moderator deletes any quack              | accepted                         | The `admin` role can delete any quack, and each such delete is logged.                                       |
| [0005](0005-emptied-quacks-keep-replies.md) | Deleting a quack with replies empties it | accepted                         | A quack with replies is emptied in place so replies survive; one without is hard-deleted.                    |
