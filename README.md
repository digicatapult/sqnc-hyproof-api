# dscp-hyproof-api

## Description

An API service for issuing hydrogen certificates

## Configuration

Use a `.env` at root of the repository to set values for the environment variables defined in `.env` file.

| variable               | required |       default       | description                                                                                  |
| :--------------------- | :------: | :-----------------: | :------------------------------------------------------------------------------------------- |
| PORT                   |    N     |       `3000`        | The port for the API to listen on                                                            |
| LOG_LEVEL              |    N     |       `debug`       | Logging level. Valid values are [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]         |
| ENVIRONMENT_VAR        |    N     |      `example`      | An environment specific variable                                                             |
| DB_PORT                |    N     |       `5432`        | The port for the database                                                                    |
| DB_HOST                |    Y     |          -          | The database hostname / host                                                                 |
| DB_NAME                |    N     | `dscp-hyproof-api ` | The database name                                                                            |
| DB_USERNAME            |    Y     |          -          | The database username                                                                        |
| DB_PASSWORD            |    Y     |          -          | The database password                                                                        |
| IDENTITY_SERVICE_HOST  |    Y     |          -          | Hostname of the `dscp-identity-service`                                                      |
| IDENTITY_SERVICE_PORT  |    N     |       `3002`        | Port of the `dscp-identity-service`                                                          |
| NODE_HOST              |    Y     |          -          | The hostname of the `dscp-node` the API should connect to                                    |
| NODE_PORT              |    N     |       `9944`        | The port of the `dscp-node` the API should connect to                                        |
| LOG_LEVEL              |    N     |       `info`        | Logging level. Valid values are [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]         |
| USER_URI               |    Y     |          -          | The Substrate `URI` representing the private key to use when making `dscp-node` transactions |
| IPFS_HOST              |    Y     |          -          | Hostname of the `IPFS` node to use for metadata storage                                      |
| IPFS_PORT              |    N     |       `5001`        | Port of the `IPFS` node to use for metadata storage                                          |
| WATCHER_POLL_PERIOD_MS |    N     |       `10000`       | Number of ms between polling of service state                                                |
| WATCHER_TIMEOUT_MS     |    N     |       `2000`        | Timeout period in ms for service state                                                       |

## Getting started

```sh
# start dependencies
docker compose up -d
# install packages
npm i
# run migrations
npm run db:migrate
# put process flows on-chain
npm run flows
# start service in dev mode. In order to start in full - npm start"
npm run dev
```

View OpenAPI documentation for all routes with Swagger:

```
localhost:3000/swagger/
```

## Database

> before performing any database interactions like clean/migrate make sure you have database running e.g. docker-compose up -d
> or any local instance if not using docker

```sh
# running migrations
npm run db:migrate

# creating new migration
## install npx globally
npm i -g knex
## make new migration with some prefixes
npx knex migrate:make --knexfile src/lib/db/knexfile.ts attachment-table
```

## Tests

Integration tests are executed by calling:

```sh
npm run test
```

Unit tests are executed by calling:

```sh
npm run test:unit
```

## Process Flows

To ensure integrity of data within transactions (and therefore on chain), it's possible to define custom processes that validate transactions. [More info](https://github.com/digicatapult/dscp-documentation/blob/main/docs/tokenModels/guardRails.md).

Process flows covering this API's transactions are in [`processFlows.json`](./processFlows.json). The file is an array of process flows that can be supplied to the [`dscp-process-management`](https://github.com/digicatapult/dscp-process-management) CLI for creating processes on chain:

```
npm run flows
```

## API design

`dscp-hyproof-api` provides a RESTful OpenAPI-based interface for third parties and front-ends to interact with the `DSCP` system. The design prioritises:

1. RESTful design principles:
   - all endpoints describing discrete operations on path derived entities.
   - use of HTTP verbs to describe whether state is modified, whether the action is idempotent etc.
   - HTTP response codes indicating the correct status of the request.
   - HTTP response bodies including the details of a query response or details about the entity being created/modified.
2. Simplicity of structure. The API should be easily understood by a third party and traversable.
3. Simplicity of usage:
   - all APIs that take request bodies taking a JSON structured request with the exception of attachment upload (which is idiomatically represented as a multipart form).
   - all APIs which return a body returning a JSON structured response (again with the exception of attachments.
4. Abstraction of the underlying DLT components. This means no token Ids, no block numbers etc.
5. Conflict free identifiers. All identifiers must be conflict free as updates can come from third party organisations.

### Fundamental entities

This is project is primary based on two entities in regards to the API.

> Certificate - that can be issued, initiated and revoked by a regulator. This is something we will keep circulating arround
> Attachments - file or json information that is stored on IPFS servie
> Transaction - records representing interactions with the chain

### Running locally

running with docker-compose -f docker-compose-3-personal.yml logs -f will render all logs, also can be parsed by `| grep`.

```
docker-compose -f docker-compose-3-personal.yml logs -f | grep regulator
```

> single persona
> Run `docker composel up -d` to start the required dependencies to fully demo `dscp-hyproof-api`.

> multiple persona
> Run `docker-compose -f docker-compose-3-personal.yml up` to start the required dependencies to fully demo `dscp-hyproof-api`.

> services

- dscp-hyproof-api (+ PostgreSQL)
- dscp-identity-service (+ PostgreSQL)
- ipfs
- dscp-node

You can run a full 3-party demonstration using `docker-compose -f docker-compose-3-persona.yml up --build -d`.

### Identities

The 3-party demonstration creates 3 personas with different roles, given below. Their Swagger API endpoints can be accessed using:

`Heidi (the Hydrogen Producer)`:

- [localhost:8000/swagger](http://localhost:8000/swagger/#/)

- [localhost:9000/v1/swagger](http://localhost:9000/v1/swagger/#/)

`Emma (the Energy Provider)`:

- [localhost:8010/swagger](http://localhost:8010/swagger/#/)

- [localhost:9010/v1/swagger](http://localhost:9010/v1/swagger/#/)

`Reginald (the Regulator)`:

- [localhost:8020/swagger](http://localhost:8020/swagger/#/)

- [localhost:9020/v1/swagger](http://localhost:9020/v1/swagger/#/)

The single-party version only uses:

- HyProof API: [localhost:3000/swagger](http://localhost:8000/swagger/#/)

- Identity Service: [localhost:3002/v1/swagger](http://localhost:9000/v1/swagger/#/)

### Using the HyProof API

You can find a basic cli walk-through for using the API in `scripts/basic-demo.md`
