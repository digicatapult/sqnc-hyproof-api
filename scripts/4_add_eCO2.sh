#!/bin/sh

# Run script using 'source ./4_add_eCO2.sh' or '. ./4_add_eCO2.sh'

emma_response=$(curl -s -X 'GET' http://localhost:8010/v1/certificate -H 'accept: application/json')

export emma_local_id=$(echo $emma_response | jq -r '.[] | .id')

echo "Emma the Energy Provider checks the cryptographic commitment"

# Assign to variable to silence output
silencer=$(curl -s -X 'PUT' http://localhost:8010/v1/certificate/$emma_local_id \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "commitment_salt": "'"$commitment_salt"'",
  "energy_consumed_wh": 2000000,
  "production_end_time": "2023-12-07T08:56:41.116Z",
  "production_start_time": "2023-12-07T07:56:41.116Z"
}'
)

sleep 1

echo "Emma the Energy Provider adds the eCO2 data"

# Assign to variable to silence output
silencer=$(curl -s -X 'POST' http://localhost:8010/v1/certificate/$emma_local_id/issuance \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"embodied_co2": 135
}'
)

sleep 1

echo "Emma submits the final certificate to be issued on the ledger"

state=$(curl -s http://localhost:8010/v1/certificate/$emma_local_id -H 'accept: application/json' | jq -r .state)

while [ "$state" != "issued" ]
do
sleep 2
state=$(curl -s http://localhost:8010/v1/certificate/$emma_local_id -H 'accept: application/json' | jq -r .state)
echo $state
done

echo "The final certificate as seen by the regulator"
# NB this will only work cleanly for the first certificate issued because it pulls from Reginald's local DB via the API

curl -s http://localhost:8020/v1/certificate/ -H 'accept: application/json' | jq -r '.[]'
