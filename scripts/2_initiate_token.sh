#!/bin/sh

# Run script using 'source ./2_initiate_token.sh' or '. ./2_initiate_token.sh'
echo "Heidi the Hydrogen Producer loads data into her local database"

export heidi_response=$(
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

echo "Loaded into local database"

export heidi_local_id=$(echo $heidi_response | jq -r .id)

export commitment_salt=$(echo $heidi_response | jq -r .commitment_salt)