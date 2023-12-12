#!/bin/sh

# Run script using 'source ./4_add_eCO2.sh' or '. ./4_add_eCO2.sh'
echo "Emma the Energy Provider adds the eCO2 data"

emma_response=$(curl -s -X 'GET' http://localhost:8010/v1/certificate -H 'accept: application/json')

emma_local_id=$(echo $emma_response | jq -r '.[] | .id')

curl -s -X 'PUT' http://localhost:8010/v1/certificate/$emma_local_id \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "commitment_salt": "'"$commitment_salt"'",
  "energy_consumed_mwh": 2,
  "production_end_time": "2023-12-07T08:56:41.116Z",
  "production_start_time": "2023-12-07T07:56:41.116Z"
}'

curl -X 'POST' http://localhost:8010/v1/certificate/$emma_local_id/issuance \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "embodied_co2": 135
}'

# sleep 1

# echo "Waiting for final certificate to be issued on the ledger"

# state=$(curl -s http://localhost:8010/v1/certificate/$emma_local_id | jq -r .state)

# while [ "$state" != "issued" ] 
# do 
# sleep 2
# state=$(curl -s http://localhost:8010/v1/certificate/$emma_local_id | jq -r .state)
# echo $state
# done

# curl -s http://localhost:8010/v1/certificate/$emma_local_id | jq -r