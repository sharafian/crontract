# Crontract
> Everything you love about `cron`, but no longer running on your machine

The crontract is a codius contract which allows users to upload tasks to
be run on an interval. It's an early WIP right now, but can be tested with:

```
DEBUG=* node index.js
```

You can then use the client at `./bin/client.js` to interface with the
local deploy of the crontract. Use `--help` for instructions. Currently,
all tasks are in the form of bash commands.

## Features Planned

- [ ] Dockerfile for deployment
- [ ] Finish writing client
- [ ] Make the client code better
- [ ] Switch from bash commands to docker images
