#!/bin/sh

heidi=$(curl -s http://localhost:9000/v1/self -H 'accept: application/json' | jq -r .address)
emma=$(curl -s http://localhost:9010/v1/self -H 'accept: application/json' | jq -r .address)
reginald=$(curl -s http://localhost:9020/v1/self -H 'accept: application/json' | jq -r .address)

# First persona (Heidi the Hydrogen Producer)
curl -X 'PUT' http://localhost:9000/v1/members/$heidi \
  -H 'Content-Type: application/json' \
  -d '{"alias":"Heidi"}'

curl -X 'PUT' http://localhost:9000/v1/members/$emma \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Emma"}'

curl -X 'PUT' http://localhost:9000/v1/members/$reginald \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Reginald"}'

# Second persona (Emma the Energy Producer)
curl -X 'PUT' http://localhost:9010/v1/members/$heidi \
  -H 'Content-Type: application/json' \
  -d '{"alias":"Heidi"}'

curl -X 'PUT' http://localhost:9010/v1/members/$emma \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Emma"}'

curl -X 'PUT' http://localhost:9010/v1/members/$reginald \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Reginald"}'

# Third persona (Reginald the Regulator)
curl -X 'PUT' http://localhost:9020/v1/members/$heidi \
  -H 'Content-Type: application/json' \
  -d '{"alias":"Heidi"}'

curl -X 'PUT' http://localhost:9020/v1/members/$emma \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Emma"}'

curl -X 'PUT' http://localhost:9020/v1/members/$reginald \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Reginald"}'