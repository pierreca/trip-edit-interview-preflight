# Setup check

Checks that Docker on your machine can run the app used in the coding
session: the same images, folder mount and ports, and none of the exercise.

```sh
docker compose up --exit-code-from check
```

The first run downloads the images, which can take a few minutes. It's done
when you see:

```
Setup works: Node v22… reached PostgreSQL 16.15.
```

It may add notes, for example that files created in containers will belong
to root (usual on Linux). Those don't stop the session; mention them when you
reply. Then clean up with `docker compose down -v`.

On Windows, clone and run this inside WSL2 (for example under `~/code`), not
on the C: drive. The check fails if the repository is on a Windows drive,
because edits there don't reach the app.

If it fails with `port is already allocated`, something else is using port
3001, 5173 or 55432. Stop it and run the check again. For anything else, send
us the output.
