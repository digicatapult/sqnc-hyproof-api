#!/bin/sh

heidi=$(curl -s http://localhost:9000/v1/self -H 'accept: application/json' | jq -r .address)
emma=$(curl -s http://localhost:9010/v1/self -H 'accept: application/json' | jq -r .address)
reginald=$(curl -s http://localhost:9020/v1/self -H 'accept: application/json' | jq -r .address)

# First persona (Heidi the Hydrogen Producer)
curl -s -X 'PUT' http://localhost:9000/v1/members/$heidi \
  -H 'Content-Type: application/json' \
  -d '{"alias":"Heidi"}' | jq -r

curl -s -X 'PUT' http://localhost:9000/v1/members/$emma \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Emma"}' | jq -r

curl -s -X 'PUT' http://localhost:9000/v1/members/$reginald \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Reginald"}' | jq -r

# Second persona (Emma the Energy Producer)
curl -s -X 'PUT' http://localhost:9010/v1/members/$heidi \
  -H 'Content-Type: application/json' \
  -d '{"alias":"Heidi"}' | jq -r

curl -s -X 'PUT' http://localhost:9010/v1/members/$emma \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Emma"}' | jq -r

curl -s -X 'PUT' http://localhost:9010/v1/members/$reginald \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Reginald"}' | jq -r

# Third persona (Reginald the Regulator)
curl -s -X 'PUT' http://localhost:9020/v1/members/$heidi \
  -H 'Content-Type: application/json' \
  -d '{"alias":"Heidi"}' | jq -r

curl -s -X 'PUT' http://localhost:9020/v1/members/$emma \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Emma"}' | jq -r

curl -s -X 'PUT' http://localhost:9020/v1/members/$reginald \
  -H 'Content-Type: application/json' \
  -d '{"alias": "Reginald"}' | jq -r