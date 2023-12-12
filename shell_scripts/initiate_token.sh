#!/bin/sh

# Run script using 'source ./initiate_token.sh' or '. ./initiate_token.sh'

echo "Load production data into local database"

heidi_response=$(
curl -s -X 'POST' \
  'http://localhost:8000/v1/certificate' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{ 
  "energy_consumed_mwh": 2,
  "production_end_time": "2023-12-07T08:56:41.116Z",
  "production_start_time": "2023-12-07T07:56:41.116Z",
  "energy_owner": "Emma",
  "regulator": "Reginald",
  "hydrogen_quantity_mwh": 3
}'
)

echo $heidi_response | jq -r

sleep 1

echo "Loaded"

export heidi_local_id=$(echo $heidi_response | jq -r .id) \
export commitment_salt=$(echo $heidi_response | jq -r .commitment_salt)

sleep 1

echo "Adding to shared ledger"

sleep 1

curl -X POST http://localhost:8000/v1/certificate/$heidi_local_id/initiation -H 'accept: application/json' -d '' | jq -r

sleep 1

echo "Check status"

curl http://localhost:8000/v1/certificate/$heidi_database_id/initiation

sleep 3

curl http://localhost:8000/v1/certificate/$heidi_database_id/initiation

sleep 3

curl http://localhost:8000/v1/certificate/$heidi_database_id/initiation